// Shared client-side passkey (WebAuthn) authentication ceremony.
//
// Consumers (2): /login and /signup — both previously copy-pasted the same
// dynamic-import → options fetch → startAuthentication → verify fetch chain
// and had already drifted (login hardcoded French toasts, signup used
// paraglide keys). Toasts stay at the call sites: this module only reports
// *what* failed via a paraglide message key.
//
// The registration ("add a passkey") flow on /account/passkeys is similar in
// shape but not identical (fresh-auth password, name payload, different
// endpoints and error keys), so it intentionally stays where it is.

export type PasskeyAuthResult =
  | { ok: true }
  | {
      ok: false;
      /**
       * Paraglide message key to surface, or `null` when the user cancelled
       * the ceremony (NotAllowedError) — show nothing in that case.
       */
      errorKey: string | null;
      /** Localized error returned by the server, preferred over `errorKey`. */
      serverError?: string;
    };

/**
 * Runs the full passkey authentication ceremony. Never throws: cancellation
 * and failures are folded into the result so call sites only decide how to
 * surface them (toast) and where to navigate on success.
 *
 * `fetchFn` is injectable for tests only.
 */
export async function authenticateWithPasskey(
  fetchFn: typeof fetch = fetch
): Promise<PasskeyAuthResult> {
  try {
    const { startAuthentication } = await import('@simplewebauthn/browser');
    const optsRes = await fetchFn('/passkeys/authentication/options', { method: 'POST' });
    if (!optsRes.ok) {
      return { ok: false, errorKey: 'errorsAccountPasskeyAuthStartFailed' };
    }
    const optsJSON = await optsRes.json();
    const assertion = await startAuthentication({ optionsJSON: optsJSON });
    const verifyRes = await fetchFn('/passkeys/authentication/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ response: assertion })
    });
    const data = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok || !data?.ok) {
      return {
        ok: false,
        errorKey: 'errorsAccountPasskeyAuthFailed',
        serverError: typeof data?.error === 'string' ? data.error : undefined
      };
    }
    return { ok: true };
  } catch (err) {
    // User cancellation surfaces as a NotAllowedError (name and/or message,
    // depending on how simplewebauthn wrapped it). Stay quiet for it.
    const text = err instanceof Error ? `${err.name} ${err.message}` : '';
    if (/NotAllowedError|cancel/i.test(text)) {
      return { ok: false, errorKey: null };
    }
    return { ok: false, errorKey: 'errorsAccountPasskeyGenericError' };
  }
}
