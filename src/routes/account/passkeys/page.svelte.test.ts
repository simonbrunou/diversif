import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { render, fireEvent, within } from '@testing-library/svelte';
import { tick } from 'svelte';
import '../../../test/component';

const toastError = mock();
const toastSuccess = mock();
const startRegistration = mock();
// The delete dialog's use:enhance callback, so a test can play SvelteKit's
// part: run it, then apply a result through `update`.
type Submit = (input: {
  cancel: () => void;
}) => ((opts: { result: { type: string }; update: () => Promise<void> }) => Promise<void>) | void;
let enhancedSubmit: Submit | undefined;
mock.module('$app/state', () => ({ page: { url: new URL('http://localhost/account/passkeys') } }));
mock.module('$app/forms', () => ({
  enhance: (_form: HTMLFormElement, submit: Submit) => {
    enhancedSubmit = submit;
    return { destroy: () => {} };
  }
}));
mock.module('$app/navigation', () => ({
  refreshAll: async () => {},
  afterNavigate: () => {},
  goto: async () => {}
}));
mock.module('$app/env', () => ({ browser: false }));
mock.module('svelte-sonner', () => ({ toast: { error: toastError, success: toastSuccess } }));
mock.module('@simplewebauthn/browser', () => ({ startRegistration }));

import type { ActionData, PageData } from './$types';

// svelte-sonner's real dist can't load under bun test, so Page is imported
// after the mocks above (static imports would hoist past mock.module).
const { default: Page } = await import('./+page.svelte');

afterEach(() => {
  toastError.mockClear();
  toastSuccess.mockClear();
  startRegistration.mockClear();
  enhancedSubmit = undefined;
});

const passkey = {
  id: 'pk-1',
  name: 'Téléphone',
  createdAt: Date.UTC(2026, 0, 5),
  lastUsedAt: null,
  backedUp: false
};

function renderPage(form: ActionData = null) {
  return render(Page, {
    props: { data: { passkeys: [passkey] } as unknown as PageData, form }
  });
}

// Opens the delete dialog, then submits it the way SvelteKit's enhance does:
// `update` applies the result to the page's `form` prop.
async function submitDelete(
  view: ReturnType<typeof renderPage>,
  result: { type: 'success' | 'failure'; data: ActionData }
) {
  await fireEvent.click(view.getByRole('button', { name: 'Supprimer' }));
  const settle = enhancedSubmit?.({ cancel: () => {} });
  if (!settle) throw new Error('the delete dialog did not register use:enhance');
  await settle({ result, update: () => view.rerender({ form: result.data }) });
  await tick();
}

describe('account/passkeys messages', () => {
  it('renders a refused rename inline, so a no-JS visitor sees why', () => {
    const { getByRole } = renderPage({ passkeyErrorKey: 'errorsAccountPasskeyNameInvalid' });
    expect(getByRole('alert').textContent).toContain('Nom invalide.');
    expect(getByRole('status').textContent?.trim()).toBe('');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('renders a successful rename inline, without a toast', () => {
    const { getByRole, queryByRole } = renderPage({
      passkeySuccessKey: 'errorsAccountPasskeyRenameSuccess'
    });
    expect(getByRole('status').textContent).toContain('Clé renommée.');
    expect(queryByRole('alert')).toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('shows a refused deletion inside the open dialog only, and drops it on Cancel', async () => {
    const view = renderPage();
    await submitDelete(view, {
      type: 'failure',
      data: { passkeyErrorKey: 'errorsAccountPasswordIncorrect' }
    });
    const dialog = view.getByRole('dialog');
    expect(within(dialog).getByRole('alert').textContent).toContain(
      'Mot de passe actuel incorrect.'
    );
    expect(view.getAllByRole('alert')).toHaveLength(1);
    expect(toastError).not.toHaveBeenCalled();

    await fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    await tick();
    expect(view.queryByRole('alert')).toBeNull();
  });

  it('labels the delete dialog’s own password field, not the one behind it', async () => {
    const view = renderPage();
    await fireEvent.click(view.getByRole('button', { name: 'Supprimer' }));
    const dialog = view.getByRole('dialog');
    // A browser resolves `for` to the first element with that id in the
    // document; getByLabelText would search the dialog only.
    const label = within(dialog).getByText('Mot de passe actuel') as HTMLLabelElement;
    const field = document.getElementById(label.htmlFor);
    expect(field && dialog.contains(field)).toBe(true);
  });

  it('replaces a loaded rename message with the refused deletion in the dialog', async () => {
    const view = renderPage({ passkeyErrorKey: 'errorsAccountPasskeyNameInvalid' });
    await submitDelete(view, {
      type: 'failure',
      data: { passkeyErrorKey: 'errorsAuthRateLimited' }
    });
    const alerts = view.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(view.getByRole('dialog').contains(alerts[0])).toBe(true);
    expect(alerts[0].textContent).toContain('Trop de tentatives. Réessayez plus tard.');
  });

  it('shows a successful deletion on the page once the dialog closes, without a toast', async () => {
    const view = renderPage();
    await submitDelete(view, {
      type: 'success',
      data: { passkeySuccessKey: 'errorsAccountPasskeyDeleteSuccess' }
    });
    expect(view.getByRole('status').textContent).toContain('Clé supprimée.');
    expect(view.queryByRole('alert')).toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe('account/passkeys registerPasskey', () => {
  it('shows the localized error when the options request was redirected (session gone)', async () => {
    // A signed-out request is redirected to /login: fetch follows it and
    // gets an HTML 200, which must not reach the WebAuthn ceremony.
    const loginPage = new Response('<!doctype html>', { status: 200 });
    Object.defineProperty(loginPage, 'redirected', { value: true });
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(loginPage);
    try {
      const { container, getByRole } = render(Page, {
        props: { data: { passkeys: [] } as unknown as PageData, form: null }
      });
      const password = container.querySelector<HTMLInputElement>('#passkeyCurrentPassword')!;
      await fireEvent.input(password, { target: { value: 'current-password-12' } });
      await fireEvent.click(getByRole('button', { name: 'Ajouter une clé' }));

      await new Promise((r) => setTimeout(r, 0));
      expect(startRegistration).not.toHaveBeenCalled();
      expect(toastError).toHaveBeenCalledWith('Impossible de démarrer l’enregistrement.');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
