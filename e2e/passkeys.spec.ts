import { test, expect, type Page } from '@playwright/test';
import { awaitHydration, openWithoutJavaScript, signUp, SIGNUP_PASSWORD } from './_helpers';

/**
 * WebAuthn passkey registration + sign-in, driven through a real Chrome
 * DevTools Protocol virtual authenticator (`WebAuthn.addVirtualAuthenticator`)
 * so the actual browser credential API — RP ID/origin binding included — is
 * exercised, not just the mocked `@simplewebauthn/browser` calls the unit
 * suite stubs out (src/lib/auth/passkey-client.test.ts).
 *
 * Requires the e2e webServer's WEBAUTHN_RP_ID to resolve to "localhost" (the
 * test origin's effective domain) — set in playwright.config.ts's
 * webServer.env. Without it, src/lib/server/passkeys.ts's resolveRPID()
 * defaults to "diversif.app", and the RP ID/effective-domain match enforced
 * by Chromium itself (not our server or the virtual authenticator) would
 * make navigator.credentials.create()/get() reject before any request
 * reaches the app.
 */
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
  await page.getByRole('button', { name: 'Ajouter une clé', exact: true }).click();

  await expect(page.getByText('Clé enregistrée.')).toBeVisible();
  await expect(page.getByLabel('Nom de la clé')).toHaveValue(name);
}

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

  test('a refused deletion shows in the open dialog, and renaming works without JavaScript', async ({
    browser,
    page
  }) => {
    await addVirtualAuthenticator(page);
    await signUp(page, 'passkey-messages');
    await registerPasskey(page, 'Téléphone');

    await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Mot de passe actuel', { exact: true }).fill('wrong-password-123');
    await dialog.getByRole('button', { name: 'Supprimer', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Mot de passe actuel incorrect.');
    // The dialog's alert appears only once the result has been applied, so
    // count right away: a toast would expire within 4 s and a retrying
    // assertion would wait it out (docs/agents/testing.md).
    expect(await page.getByText('Mot de passe actuel incorrect.').count()).toBe(1);
    await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await page.getByText('Mot de passe actuel incorrect.').count()).toBe(0);

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
  });
});
