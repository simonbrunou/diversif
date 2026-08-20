import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, cleanup } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import { writable } from 'svelte/store';

const toastFn = mock((_message: string, _opts?: unknown) => {});
// svelte-sonner's real dist can't load under bun test (see form-toasts.test.ts
// for the same reasoning) — mock before the component import pulls it in.
mock.module('svelte-sonner', () => ({ toast: toastFn }));

const needRefresh = writable(false);
const updateServiceWorker = mock(() => Promise.resolve());
// vite-plugin-pwa's virtual module only exists at build time; stub the
// Svelte store shape (needRefresh) + action (updateServiceWorker) it exposes.
mock.module('virtual:pwa-register/svelte', () => ({
  useRegisterSW: () => ({ needRefresh, updateServiceWorker })
}));

const { default: ReloadPrompt } = await import('./ReloadPrompt.svelte');

afterEach(() => {
  cleanup();
  toastFn.mockClear();
  updateServiceWorker.mockClear();
  needRefresh.set(false);
});

describe('ReloadPrompt', () => {
  it('shows the update toast once needRefresh becomes true', () => {
    render(ReloadPrompt);
    needRefresh.set(true);
    flushSync();
    expect(toastFn).toHaveBeenCalledTimes(1);
  });

  it('stops re-showing the toast for the rest of the session after a dismiss', () => {
    render(ReloadPrompt);
    needRefresh.set(true);
    flushSync();
    expect(toastFn).toHaveBeenCalledTimes(1);

    const options = toastFn.mock.calls[0]?.[1] as { onDismiss?: () => void } | undefined;
    options?.onDismiss?.();

    // A later reactive re-run (e.g. needRefresh toggling again) must not
    // bring the toast back once the user has dismissed it this session.
    needRefresh.set(false);
    flushSync();
    needRefresh.set(true);
    flushSync();
    expect(toastFn).toHaveBeenCalledTimes(1);
  });
});
