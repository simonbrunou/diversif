import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import 'fake-indexeddb/auto';
import '../../test/component';

// RepasForm only applies the durable submit's outcome to the page; these
// stand-ins record what it applied, in order. The submit itself runs for
// real, over fetch (spied) and fake-indexeddb.
let events: string[] = [];
const applyAction = mock(async (_result: unknown) => {
  events.push('applyAction started');
  await Promise.resolve();
  events.push('applyAction done');
});
const goto = mock(async (_url: string) => {});
const toast = { success: mock((_m: string) => {}), error: mock((_m: string) => {}) };
mock.module('$app/forms', () => ({ applyAction, enhance: () => ({ destroy() {} }) }));
mock.module('$app/navigation', () => ({ goto }));
mock.module('svelte-sonner', () => ({ toast }));

const { default: RepasForm } = await import('./RepasForm.svelte');
const { clear, count } = await import('#lib/offline/queue.js');
const { overwriteGetLocale } = await import('#lib/paraglide/runtime.js');

const fields = createRawSnippet(() => ({
  render: () =>
    `<div><input name="foodId" value="7"><input name="givenAt" value="2026-05-07T12:30"><button type="submit">Enregistrer</button></div>`
}));

function renderForm(props: {
  queueFor?: number;
  action?: string;
  onapplied?: (result: { type: string }) => void;
}) {
  let busy = false;
  const { container } = render(RepasForm, {
    props: {
      ...props,
      get busy() {
        return busy;
      },
      set busy(v: boolean) {
        busy = v;
        events.push(`busy=${v}`);
      },
      children: fields
    }
  });
  return container.querySelector('form')!;
}

const redirect = () =>
  new Response(JSON.stringify({ type: 'redirect', status: 303, location: '/child/1?logged=1' }), {
    headers: { 'content-type': 'application/json' }
  });

function goOffline(): void {
  Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
}

beforeEach(async () => {
  events = [];
  applyAction.mockClear();
  goto.mockClear();
  toast.success.mockClear();
  toast.error.mockClear();
  await clear();
});

afterEach(() => {
  delete (navigator as { onLine?: boolean }).onLine;
  overwriteGetLocale(() => 'fr');
});

describe('RepasForm', () => {
  it('posts the form and applies the server answer, busy until it is applied', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => redirect());
    const form = renderForm({ queueFor: 1 });

    await fireEvent.submit(form);
    await waitFor(() => expect(events).toContain('busy=false'));

    expect(form.getAttribute('method')).toBe('POST');
    expect(events).toEqual(['busy=true', 'applyAction started', 'applyAction done', 'busy=false']);
    expect(applyAction.mock.calls[0][0]).toEqual({
      type: 'redirect',
      status: 303,
      location: '/child/1?logged=1'
    });
    const body = new URLSearchParams(String(fetchSpy.mock.calls[0][1]!.body));
    expect(body.get('foodId')).toBe('7');
    expect(body.get('givenAt')).toBe(new Date('2026-05-07T12:30').toISOString());
  });

  it('ignores a second submit while the first is in flight', async () => {
    let answer: (r: Response) => void = () => {};
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => (answer = resolve))
    );
    const form = renderForm({ queueFor: 1 });

    await fireEvent.submit(form);
    await fireEvent.submit(form);
    answer(redirect());
    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('queues the log form offline, says so and goes back to the dashboard', async () => {
    goOffline();
    const fetchSpy = spyOn(globalThis, 'fetch');
    const form = renderForm({ queueFor: 1 });

    await fireEvent.submit(form);
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/child/1'));

    expect(toast.success).toHaveBeenCalledWith('Enregistré hors-ligne, sera synchronisé.');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(applyAction).not.toHaveBeenCalled();
    expect(await count()).toBe(1);
  });

  it('goes back to the dashboard in the parent’s language', async () => {
    overwriteGetLocale(() => 'en');
    goOffline();
    const form = renderForm({ queueFor: 1 });

    await fireEvent.submit(form);
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/en/child/1'));
  });

  it('keeps the log form and says so when the repas can neither be sent nor queued', async () => {
    goOffline();
    spyOn(indexedDB, 'open').mockImplementation(() => {
      throw new DOMException('IndexedDB unavailable', 'UnknownError');
    });
    const form = renderForm({ queueFor: 1 });

    await fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

    expect(toast.error.mock.calls[0][0]).toContain('Impossible d’enregistrer hors-ligne');
    expect(goto).not.toHaveBeenCalled();
  });

  // The edit forms post to `?/update&from=…` (#443): the query next to the
  // action key must reach the server as the form resolved it.
  it('posts an edit to its resolved action, the query after the action key included', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => redirect());
    const form = renderForm({ action: '?/update&from=detail' });

    await fireEvent.submit(form);
    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));

    expect(new URL(String(fetchSpy.mock.calls[0][0])).search).toBe('?/update&from=detail');
  });

  // The edit page reads a reaction refusal's stored reactions there (#445).
  it('hands the server answer to onapplied once it is applied', async () => {
    spyOn(globalThis, 'fetch').mockImplementation(async () => redirect());
    const onapplied = (result: { type: string }) => events.push(`onapplied ${result.type}`);
    const form = renderForm({ action: '?/update', onapplied });

    await fireEvent.submit(form);
    await waitFor(() => expect(events).toContain('busy=false'));

    expect(events).toEqual([
      'busy=true',
      'applyAction started',
      'applyAction done',
      'onapplied redirect',
      'busy=false'
    ]);
  });

  it('keeps an edit form that cannot reach the server, and says so', async () => {
    spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const onapplied = mock(() => {});
    const form = renderForm({ action: '?/update', onapplied });

    await fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

    expect(toast.error.mock.calls[0][0]).toContain('Impossible de joindre le serveur');
    expect(applyAction).not.toHaveBeenCalled();
    expect(onapplied).not.toHaveBeenCalled();
    expect(goto).not.toHaveBeenCalled();
    expect(await count()).toBe(0);
    expect(events).toEqual(['busy=true', 'busy=false']);
  });
});
