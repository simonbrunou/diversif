import { describe, expect, it, mock } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../../test/component';

mock.module('$app/state', () => ({ page: { url: new URL('http://localhost/account/delete') } }));
mock.module('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));
mock.module('$app/navigation', () => ({ afterNavigate: () => {}, goto: async () => {} }));
mock.module('$app/env', () => ({ browser: false }));
// The page doesn't toast; the mock catches a toast creeping back in, which
// would show a refusal twice.
const toastError = mock();
mock.module('svelte-sonner', () => ({ toast: { error: toastError, success: () => {} } }));

import type { ActionData, PageData } from './$types';

// Static imports would hoist past mock.module, so Page is imported after the
// mocks above.
const { default: Page } = await import('./+page.svelte');

function renderPage(email: string, form: ActionData = null) {
  return render(Page, {
    props: { data: { user: { email } } as unknown as PageData, form }
  });
}

describe('account/delete page', () => {
  it('renders a refused deletion inline, so a no-JS visitor sees why', () => {
    const { getByRole } = renderPage('p@example.com', {
      deleteErrorKey: 'errorsAccountDeleteEmailMismatch'
    });
    expect(getByRole('alert').textContent).toContain(
      'Saisissez votre adresse e-mail exacte pour confirmer.'
    );
    expect(toastError).not.toHaveBeenCalled();
  });

  it('re-inserts the alert on a second identical refusal, so it is announced again', async () => {
    const refusal = { deleteErrorKey: 'errorsAccountPasswordIncorrect' } as const;
    const { getByRole, rerender } = renderPage('p@example.com', { ...refusal });
    const first = getByRole('alert');
    await rerender({ form: { ...refusal } });
    expect(getByRole('alert')).not.toBe(first);
    expect(getByRole('alert').textContent).toContain('Mot de passe actuel incorrect.');
  });

  it('refills the typed email after a refusal, and never the password', async () => {
    const { getByLabelText, rerender } = renderPage('p@example.com', {
      deleteErrorKey: 'errorsAccountPasswordIncorrect',
      confirmEmail: 'autre@example.com'
    });
    const email = getByLabelText(
      'Saisissez votre adresse e-mail pour confirmer'
    ) as HTMLInputElement;
    const password = getByLabelText('Confirmez avec votre mot de passe') as HTMLInputElement;
    expect(email.value).toBe('autre@example.com');
    expect(password.value).toBe('');

    // Seeded once, like login's email: a later result never overwrites typing.
    await fireEvent.input(email, { target: { value: 'p@example.com' } });
    await rerender({
      form: { deleteErrorKey: 'errorsAccountPasswordIncorrect', confirmEmail: 'tiers@example.com' }
    });
    expect(email.value).toBe('p@example.com');
  });

  it('renders no alert before any submission', () => {
    const { queryByRole } = renderPage('p@example.com');
    expect(queryByRole('alert')).toBeNull();
  });

  it('once hydrated, keeps the button disabled until the email matches and a password is typed', async () => {
    // Mixed case on both sides: the action lowercases both, so the button must too.
    const { getByLabelText, getByRole } = renderPage('Parent@Example.com');
    const button = getByRole('button', { name: 'Supprimer définitivement mon compte' });
    expect(button.hasAttribute('disabled')).toBe(true);

    const email = getByLabelText('Saisissez votre adresse e-mail pour confirmer');
    await fireEvent.input(email, { target: { value: ' PARENT@example.com ' } });
    expect(button.hasAttribute('disabled')).toBe(true);

    const password = getByLabelText('Confirmez avec votre mot de passe');
    await fireEvent.input(password, { target: { value: 'current-password-12' } });
    expect(button.hasAttribute('disabled')).toBe(false);

    await fireEvent.input(email, { target: { value: 'autre@example.com' } });
    expect(button.hasAttribute('disabled')).toBe(true);
  });
});
