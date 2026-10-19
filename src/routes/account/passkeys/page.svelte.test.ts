import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../../test/component';

const toastError = mock();
const startRegistration = mock();
mock.module('$app/state', () => ({ page: { url: new URL('http://localhost/account/passkeys') } }));
mock.module('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));
mock.module('$app/navigation', () => ({
  refreshAll: async () => {},
  afterNavigate: () => {},
  goto: async () => {}
}));
mock.module('$app/env', () => ({ browser: false }));
mock.module('svelte-sonner', () => ({ toast: { error: toastError, success: () => {} } }));
mock.module('@simplewebauthn/browser', () => ({ startRegistration }));

import type { PageData } from './$types';

// svelte-sonner's real dist can't load under bun test, so Page is imported
// after the mocks above (static imports would hoist past mock.module).
const { default: Page } = await import('./+page.svelte');

afterEach(() => {
  toastError.mockClear();
  startRegistration.mockClear();
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
      const password = container.querySelector<HTMLInputElement>('#currentPassword')!;
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
