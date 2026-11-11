import { describe, expect, it, mock } from 'bun:test';
import { fireEvent, render, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import '../../test/component';

// What RepasForm does with an edit that timed out (#577). RepasForm.test.ts
// runs the real submit, whose 30 s deadline no test can wait out: Bun's runner
// can't advance setTimeout. This file mocks the submit to answer the timeout
// at once, as testing.md's « A repas form's result » does; submit.test.ts
// proves the submit answers it once its deadline passes.
const events: string[] = [];
const applyAction = mock(async (_result: unknown) => {});
const goto = mock(async (_url: string) => {});
const toast = { success: mock((_m: string) => {}), error: mock((_m: string) => {}) };
const submitRepas = mock(async (_form: FormData, _target: unknown) => ({
  kind: 'timedOut' as const
}));
mock.module('$app/forms', () => ({ applyAction, enhance: () => ({ destroy() {} }) }));
mock.module('$app/navigation', () => ({ goto }));
mock.module('svelte-sonner', () => ({ toast }));
mock.module('#lib/offline/submit.js', () => ({ submitRepas }));

const { default: RepasForm } = await import('./RepasForm.svelte');

const fields = createRawSnippet(() => ({
  render: () =>
    `<div><input name="foodId" value="7"><input name="notes" value="Mangé avec appétit"><button type="submit">Enregistrer</button></div>`
}));

describe('RepasForm, an edit past the submit deadline', () => {
  it('keeps the form as typed and says the save may not have gone through', async () => {
    let busy = false;
    const onapplied = mock(() => {});
    const { container } = render(RepasForm, {
      props: {
        action: '?/update',
        onapplied,
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
    const form = container.querySelector('form')!;
    const notes = form.querySelector<HTMLInputElement>('input[name="notes"]')!;
    notes.value = 'Mangé la moitié';

    await fireEvent.submit(form);
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));

    expect(submitRepas).toHaveBeenCalledTimes(1);
    expect(submitRepas.mock.calls[0][1]).toEqual({
      action: 'http://localhost/?/update',
      queueFor: undefined
    });
    expect(toast.error.mock.calls[0][0]).toBe(
      'L’enregistrement n’a peut-être pas abouti. Vérifiez votre connexion, puis réessayez.'
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(applyAction).not.toHaveBeenCalled();
    expect(onapplied).not.toHaveBeenCalled();
    expect(goto).not.toHaveBeenCalled();
    expect(form.isConnected).toBe(true);
    expect(notes.value).toBe('Mangé la moitié');
    expect(events).toEqual(['busy=true', 'busy=false']);
  });
});
