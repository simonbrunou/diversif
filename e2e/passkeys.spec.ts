import { test, expect, type Page } from '@playwright/test';
import {
  awaitHydration,
  countText,
  openWithoutJavaScript,
  signUp,
  SIGNUP_PASSWORD
} from './_helpers';

async function addVirtualAuthenticator(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true
    }
  });
}

async function registerPasskey(page: Page, name: string) {
  await page.goto('/account/passkeys');
  await awaitHydration(page);
  // The registration ceremony's fresh-auth check needs the account's own
  // current password.
  await page.getByLabel('Mot de passe', { exact: true }).fill(SIGNUP_PASSWORD);
  await page.getByLabel('Nom de la nouvelle clé').fill(name);
  // The empty state « Aucune clé enregistrée. » stays on screen until the
  // list refresh that follows the toast, and a substring toast locator
  // matches both (#509). Before the click no toast has shown yet, so the
  // toast locator must find nothing. A substring locator would find the
  // empty state there and fail every run, not only under load.
  await expect(page.getByText('Aucune clé enregistrée.', { exact: true })).toBeVisible();
  const registeredToast = page.getByText('Clé enregistrée.', { exact: true });
  expect(await registeredToast.count()).toBe(0);
  await page.getByRole('button', { name: 'Ajouter une clé', exact: true }).click();

  await expect(registeredToast).toBeVisible();
  await expect(page.getByLabel('Nom de la clé')).toHaveValue(name);
}

async function submitDelete(page: Page, password: string) {
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Mot de passe actuel', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
  return dialog;
}

/**
 * WebAuthn passkeys, driven through a real Chrome DevTools Protocol virtual
 * authenticator (`WebAuthn.addVirtualAuthenticator`) so the actual browser
 * credential API — RP ID/origin binding included — is exercised, not just
 * the mocked `@simplewebauthn/browser` calls the unit suite stubs out
 * (src/lib/auth/passkey-client.test.ts): registration and sign-in, then the
 * rename and delete messages on /account/passkeys.
 *
 * Requires the e2e webServer's WEBAUTHN_RP_ID to resolve to "localhost" (the
 * test origin's effective domain) — set in playwright.config.ts's
 * webServer.env. Without it, src/lib/server/passkeys.ts's resolveRPID()
 * defaults to "diversif.app", and the RP ID/effective-domain match enforced
 * by Chromium itself (not our server or the virtual authenticator) would
 * make navigator.credentials.create()/get() reject before any request
 * reaches the app.
 */
test.describe('passkeys', () => {
  test('registers a passkey via /account/passkeys and signs in with it on /login', async ({
    page
  }) => {
    await addVirtualAuthenticator(page);
    // /login's onMount pre-arms a *passive* conditional-UI ceremony
    // (browserSupportsWebAuthnAutofill → startAuthentication) against this
    // same virtual authenticator, racing the explicit button click below —
    // real credential managers report conditional-mediation support too, so
    // this isn't test-only. Disable it so the click this test drives is
    // deterministically what completes the sign-in.
    await page.addInitScript(() => {
      const pkc = window.PublicKeyCredential as unknown as {
        isConditionalMediationAvailable?: () => Promise<boolean>;
      };
      if (pkc?.isConditionalMediationAvailable) {
        pkc.isConditionalMediationAvailable = () => Promise.resolve(false);
      }
    });

    await signUp(page, 'passkey');
    await registerPasskey(page, 'CDP virtual authenticator');

    await page.goto('/account/sessions');
    await awaitHydration(page);
    await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);

    await awaitHydration(page);
    await page
      .getByRole('button', { name: /clé d.accès/i })
      .first()
      .click();

    // No child created yet for this account: a successful passkey sign-in
    // lands on the onboarding step, same as a fresh signup would.
    await expect(page).toHaveURL(/\/child\/new/, { timeout: 15_000 });
  });

  test('rename and delete results show once, and renaming works without JavaScript', async ({
    browser,
    page
  }) => {
    await addVirtualAuthenticator(page);
    await signUp(page, 'passkey-messages');
    await registerPasskey(page, 'Téléphone');

    // Rename posts natively, so its result comes with a new page load.
    await page.getByLabel('Nom de la clé').fill('   ');
    await page.getByRole('button', { name: 'Renommer', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Nom invalide.');
    await awaitHydration(page);
    expect(await countText(page, 'Nom invalide.')).toBe(1);

    await page.getByLabel('Nom de la clé').fill('Téléphone perso');
    await page.getByRole('button', { name: 'Renommer', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('Clé renommée.');
    await awaitHydration(page);
    expect(await countText(page, 'Clé renommée.')).toBe(1);
    expect(await countText(page, 'Nom invalide.')).toBe(0);

    // A refused deletion shows in the dialog, which stays open, and not on
    // the page behind it, not even after Cancel.
    const dialog = await submitDelete(page, 'wrong-password-123');
    await expect(dialog.getByRole('alert')).toHaveText('Mot de passe actuel incorrect.');
    expect(await countText(page, 'Mot de passe actuel incorrect.')).toBe(1);
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await countText(page, 'Mot de passe actuel incorrect.')).toBe(0);

    const noJs = await openWithoutJavaScript(browser, page);
    try {
      await noJs.goto('/account/passkeys');
      await noJs.getByLabel('Nom de la clé').fill('   ');
      await noJs.getByRole('button', { name: 'Renommer', exact: true }).click();
      await expect(noJs.getByRole('alert')).toHaveText('Nom invalide.');

      await noJs.getByLabel('Nom de la clé').fill('Clé du bureau');
      await noJs.getByRole('button', { name: 'Renommer', exact: true }).click();
      await expect(noJs.getByRole('status')).toHaveText('Clé renommée.');
      await expect(noJs.getByLabel('Nom de la clé')).toHaveValue('Clé du bureau');
    } finally {
      await noJs.context().close();
    }

    // The dialog closes before a successful deletion's result lands on the page.
    await page.goto('/account/passkeys');
    await awaitHydration(page);
    await submitDelete(page, SIGNUP_PASSWORD);
    await expect(page.getByRole('status')).toHaveText('Clé supprimée.');
    expect(await countText(page, 'Clé supprimée.')).toBe(1);
    await expect(page.getByText('Aucune clé enregistrée.', { exact: true })).toBeVisible();
  });
});
