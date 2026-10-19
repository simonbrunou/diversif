import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import 'fake-indexeddb/auto';
import '../../test/component';

// RepasForm only applies the durable submit's outcome to the page; these
// stand-ins record what it applied. The submit itself runs for real, over
// fetch (spied) and fake-indexeddb.
const applyAction = mock(async (_result: unknown) => {});
const goto = mock(async (_url: string) => {});
const toast = { success: mock((_m: string) => {}), error: mock((_m: string) => {}) };
mock.module('$app/forms', () => ({ applyAction, enhance: () => ({ destroy() {} }) }));
mock.module('$app/navigation', () => ({ goto }));
mock.module('svelte-sonner', () => ({ toast }));

const { default: RepasForm } = await import('./RepasForm.svelte');
const { clear, count } = await import('#lib/offline/queue.js');

const fields = createRawSnippet(() => ({
  render: () =>
    `<div><input name="foodId" value="7"><input name="givenAt" value="2026-05-07T12:30"><button type="submit">Enregistrer</button></div>`
}));

function renderForm(props: { queueFor?: number; action?: string }) {
  const busy: boolean[] = [];
  const { container } = render(RepasForm, {
    props: {
      ...props,
      get busy() {
        return busy.at(-1) ?? false;
      },
      set busy(v: boolean) {
        busy.push(v);
      },
      children: fields
    }
  });
  return { form: container.querySelector('form')!, busy };
}

const redirect = () =>
  new Response(JSON.stringify({ type: 'redirect', status: 303, location: '/child/1?logged=1' }), {
    headers: { 'content-type': 'application/json' }
  });

beforeEach(async () => {
  applyAction.mockClear();
  goto.mockClear();
  toast.success.mockClear();
  toast.error.mockClear();
  await clear();
});

afterEach(() => {
  delete (navigator as { onLine?: boolean }).onLine;
});

describe('RepasForm', () => {
  it('posts the form and applies the server answer, busy until it is applied', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => redirect());
    const { form, busy } = renderForm({ queueFor: 1 });

    await fireEvent.submit(form);
    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));

    expect(form.getAttribute('method')).toBe('POST');
    expect(applyAction.mock.calls[0][0]).toEqual({
      type: 'redirect',
      status: 303,
      location: '/child/1?logged=1'
    });
    const body = new URLSearchParams(String(fetchSpy.mock.calls[0][1]!.body));
    expect(body.get('foodId')).toBe('7');
    expect(body.get('givenAt')).toBe(new Date('2026-05-07T12:30').toISOString());
    expect(busy).toEqual([true, false]);
  });

  it('ignores a second submit while the first is in flight', async () => {
    let answer: (r: Response) => void = () => {};
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      () => new Promise<Response>((resolve) => (answer = resolve))
    );
    const { form } = renderForm({ queueFor: 1 });

    await fireEvent.submit(form);
    await fireEvent.submit(form);
    answer(redirect());
    await waitFor(() => expect(applyAction).toHaveBeenCalledTimes(1));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('queues the log form offline, says so and goes back to the dashboard', async () => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
    const fetchSpy = spyOn(globalThis, 'fetch');
    const { form } = renderForm({ queueFor: 1 });

    await fireEvent.submit(form);
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/child/1'));

    expect(toast.success).toHaveBeenCalledWith('Enregistré hors-ligne, sera synchronisé.');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(applyAction).not.toHaveBeenCalled();
    expect(await count()).toBe(1);
  });

  it('keeps an edit form that cannot reach the server, and says so', async () => {
    spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    const { form, busy } = renderForm({ action: '?/update' });

    await fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

    expect(toast.error.mock.calls[0][0]).toContain('Impossible d’enregistrer hors-ligne');
    expect(applyAction).not.toHaveBeenCalled();
    expect(goto).not.toHaveBeenCalled();
    expect(await count()).toBe(0);
    expect(busy).toEqual([true, false]);
  });
});
