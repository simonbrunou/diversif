import { describe, expect, it, mock } from 'bun:test';
import { render } from '@testing-library/svelte';
import '../../../test/component';

mock.module('$app/state', () => ({ page: { url: new URL('http://localhost/account/profile') } }));
mock.module('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));
mock.module('$app/navigation', () => ({ afterNavigate: () => {}, goto: async () => {} }));
mock.module('$app/env', () => ({ browser: false }));
// The page renders its result inline; a toast would show it a second time.
const toastError = mock();
const toastSuccess = mock();
mock.module('svelte-sonner', () => ({ toast: { error: toastError, success: toastSuccess } }));

import type { ActionData, PageData } from './$types';

// Static imports would hoist past mock.module, so Page is imported after the
// mocks above.
const { default: Page } = await import('./+page.svelte');

function renderPage(form: ActionData = null) {
  return render(Page, {
    props: { data: { user: { displayName: 'Camille' } } as unknown as PageData, form }
  });
}

describe('account/profile page', () => {
  it('renders a refused update inline, so a no-JS visitor sees why', () => {
    const { getByRole } = renderPage({ profileErrorKey: 'errorsAccountProfileNameInvalid' });
    expect(getByRole('alert').textContent).toContain('Nom invalide.');
    expect(getByRole('status').textContent?.trim()).toBe('');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('renders a successful update inline, without a toast', () => {
    const { getByRole, queryByRole } = renderPage({
      profileSuccessKey: 'errorsAccountProfileSuccess'
    });
    expect(getByRole('status').textContent).toContain('Profil mis à jour.');
    expect(queryByRole('alert')).toBeNull();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('shows a result applied after load once, inline', async () => {
    const { getByRole, queryByRole, rerender } = renderPage();
    await rerender({ form: { profileErrorKey: 'errorsAccountProfileNameInvalid' } });
    expect(getByRole('alert').textContent).toContain('Nom invalide.');
    await rerender({ form: { profileSuccessKey: 'errorsAccountProfileSuccess' } });
    expect(queryByRole('alert')).toBeNull();
    expect(getByRole('status').textContent).toContain('Profil mis à jour.');
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('renders no message before any submission', () => {
    const { getByRole, queryByRole } = renderPage();
    expect(queryByRole('alert')).toBeNull();
    expect(getByRole('status').textContent?.trim()).toBe('');
  });
});
