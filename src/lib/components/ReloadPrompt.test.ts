import { afterAll, afterEach, beforeAll, describe, expect, it, mock, spyOn } from 'bun:test';
import { render, cleanup } from '@testing-library/svelte';

const toastFn = mock((_message: string, _opts?: unknown) => {});
// svelte-sonner's real dist can't load under bun test (see form-toasts.test.ts
// for the same reasoning) — mock before the component import pulls it in.
mock.module('svelte-sonner', () => ({ toast: toastFn }));

// Production build: the component only registers the worker outside dev.
mock.module('$app/env', () => ({ browser: true, building: false, dev: false, version: 'test' }));

// Stand-in for workbox-window's Workbox: tests fire its lifecycle events by
// hand, the way the real one does once a new worker has installed.
class FakeWorkbox extends EventTarget {
  static last: FakeWorkbox | undefined;
  constructor() {
    super();
    FakeWorkbox.last = this;
  }
  register = () => Promise.resolve(undefined);
}
mock.module('workbox-window', () => ({ Workbox: FakeWorkbox }));

// The installed-but-waiting worker the browser reports for this scope.
// `told` settles when the component posts it a message.
class FakeWaitingWorker extends EventTarget {
  state: ServiceWorkerState = 'installed';
  #told = Promise.withResolvers<unknown>();
  told = this.#told.promise;
  postMessage = (message: unknown) => this.#told.resolve(message);
  activate() {
    this.state = 'activated';
    this.dispatchEvent(new Event('statechange'));
  }
}
let registration: { waiting: FakeWaitingWorker | null } | undefined;

const { default: ReloadPrompt } = await import('./ReloadPrompt.svelte');

type ToastOptions = { action: { onClick: () => void }; onDismiss: () => void };
const lastToastOptions = () => toastFn.mock.calls.at(-1)?.[1] as ToastOptions;
const newWorkerWaiting = () => FakeWorkbox.last!.dispatchEvent(new Event('waiting'));
// Stubs window.location.reload; `reloaded` settles on the first call.
function stubReload() {
  const { promise: reloaded, resolve } = Promise.withResolvers<void>();
  const spy = spyOn(window.location, 'reload').mockImplementation(() => resolve());
  return { spy, reloaded };
}

const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker');
beforeAll(() => {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { getRegistration: () => Promise.resolve(registration) },
    configurable: true
  });
});
afterAll(() => {
  if (originalServiceWorker)
    Object.defineProperty(navigator, 'serviceWorker', originalServiceWorker);
  else Reflect.deleteProperty(navigator, 'serviceWorker');
});

afterEach(() => {
  cleanup();
  toastFn.mockClear();
  FakeWorkbox.last = undefined;
  registration = undefined;
});

describe('ReloadPrompt', () => {
  it('shows the update toast once a new service worker is waiting', () => {
    render(ReloadPrompt);
    expect(toastFn).not.toHaveBeenCalled();
    newWorkerWaiting();
    expect(toastFn).toHaveBeenCalledTimes(1);
  });

  it('tells the waiting worker to take over and reloads once it is active', async () => {
    const reload = stubReload();
    const waiting = new FakeWaitingWorker();
    registration = { waiting };
    render(ReloadPrompt);
    newWorkerWaiting();
    lastToastOptions().action.onClick();

    expect(await waiting.told).toEqual({ type: 'SKIP_WAITING' });
    expect(reload.spy).not.toHaveBeenCalled();
    // No controllerchange needed: the tab that installed the first worker
    // isn't controlled by it, yet must still reload.
    waiting.activate();
    expect(reload.spy).toHaveBeenCalledTimes(1);
    reload.spy.mockRestore();
  });

  it('reloads at once when another tab already accepted the update', async () => {
    const reload = stubReload();
    registration = { waiting: null };
    render(ReloadPrompt);
    newWorkerWaiting();
    lastToastOptions().action.onClick();

    await reload.reloaded;
    expect(reload.spy).toHaveBeenCalledTimes(1);
    reload.spy.mockRestore();
  });

  it('stops re-showing the toast for the rest of the session after a dismiss', () => {
    render(ReloadPrompt);
    newWorkerWaiting();
    expect(toastFn).toHaveBeenCalledTimes(1);
    lastToastOptions().onDismiss();

    // A later deploy reaching the waiting state again must not bring the
    // toast back once the user has dismissed it this session.
    newWorkerWaiting();
    expect(toastFn).toHaveBeenCalledTimes(1);
  });
});
