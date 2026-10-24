import { describe, expect, it, mock } from 'bun:test';
import { render } from '@testing-library/svelte';
import '../../../test/component';

mock.module('$app/state', () => ({ page: { url: new URL('http://localhost/account/password') } }));
mock.module('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));
mock.module('$app/navigation', () => ({ afterNavigate: () => {}, goto: async () => {} }));
mock.module('$app/env', () => ({ browser: false }));
// The page renders its result inline; a toast would show it a second time.
const toastError = mock();
const toastSuccess = mock();
mock.module('svelte-sonner', () => ({ toast: { error: toastError, success: toastSuccess } }));

import type { ActionData } from './$types';

// Static imports would hoist past mock.module, so Page is imported after the
// mocks above.
const { default: Page } = await import('./+page.svelte');

function renderPage(form: ActionData = null) {
  return render(Page, { props: { form } });
}

describe('account/password page', () => {
  it('renders a refused change inline, so a no-JS visitor sees why', () => {
    const { getByRole } = renderPage({ passwordErrorKey: 'errorsAccountPasswordIncorrect' });
    expect(getByRole('alert').textContent).toContain('Mot de passe actuel incorrect.');
    expect(getByRole('status').textContent?.trim()).toBe('');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('renders a successful change inline, without a toast', () => {
    const { getByRole, queryByRole } = renderPage({
      passwordSuccessKey: 'errorsAccountPasswordSuccess'
    });
    expect(getByRole('status').textContent).toContain('Mot de passe modifié.');
    expect(queryByRole('alert')).toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('shows a result applied after load once, inline', async () => {
    const { getByRole, queryByRole, rerender } = renderPage();
    await rerender({ form: { passwordErrorKey: 'errorsAuthRateLimited' } });
    expect(getByRole('alert').textContent).toContain('Trop de tentatives. Réessayez plus tard.');
    await rerender({ form: { passwordSuccessKey: 'errorsAccountPasswordSuccess' } });
    expect(queryByRole('alert')).toBeNull();
    expect(getByRole('status').textContent).toContain('Mot de passe modifié.');
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('renders no message before any submission', () => {
    const { getByRole, queryByRole } = renderPage();
    expect(queryByRole('alert')).toBeNull();
    expect(getByRole('status').textContent?.trim()).toBe('');
  });
});
