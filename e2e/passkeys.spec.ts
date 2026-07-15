import { test, expect } from '@playwright/test';
import { awaitHydration, signUp } from './_helpers';

// Same fixed password `signUp()` always submits (see e2e/_helpers.ts) — the
// registration ceremony's fresh-auth check needs it to reissue the account's
// own current password.
const SIGNUP_PASSWORD = 'hunter2-very-long';

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
test.describe('passkeys', () => {
  test('registers a passkey via /account/passkeys and signs in with it on /login', async ({
    page
  }) => {
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

    await page.goto('/account/passkeys');
    await awaitHydration(page);
    await page.getByLabel('Mot de passe', { exact: true }).fill(SIGNUP_PASSWORD);
    await page.getByLabel('Nom de la nouvelle clé').fill('CDP virtual authenticator');
    await page.getByRole('button', { name: 'Ajouter une clé', exact: true }).click();

    await expect(page.getByText('Clé enregistrée.')).toBeVisible();
    await expect(page.getByLabel('Nom de la clé')).toHaveValue('CDP virtual authenticator');

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
});
