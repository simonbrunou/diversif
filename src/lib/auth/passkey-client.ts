// Shared client-side passkey (WebAuthn) authentication ceremony.
//
// Consumers (2): /login and /signup — both previously copy-pasted the same
// dynamic-import → options fetch → startAuthentication → verify fetch chain
// and had already drifted (login hardcoded French toasts, signup used
// paraglide keys). `signInWithPasskey` owns the full click-to-outcome flow
// (busy flag, redirect, toast) so the two pages can't drift again.
//
// The registration ("add a passkey") flow on /account/passkeys is similar in
// shape but not identical (fresh-auth password, name payload, different
// endpoints and error keys), so it intentionally stays where it is.

import { goto } from '$app/navigation';
import * as m from '$lib/paraglide/messages';
import { localizedHref } from '$lib/utils/localized-href';

/**
 * Literal union (not string) so a renamed paraglide key is a compile error
 * instead of a runtime fallback toast.
 */
type PasskeyErrorKey =
  | 'errorsAccountPasskeyAuthStartFailed'
  | 'errorsAccountPasskeyAuthFailed'
  | 'errorsAccountPasskeyGenericError';

export type PasskeyAuthResult =
  | { ok: true }
  | {
      ok: false;
      /**
       * Paraglide message key to surface, or `null` when the user cancelled
       * the ceremony (NotAllowedError) — show nothing in that case. The
       * server's own failure string is deliberately ignored: it is a single
       * uniform French message (oracle prevention), so the localized key is
       * strictly better for EN users.
       */
      errorKey: PasskeyErrorKey | null;
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
      return { ok: false, errorKey: 'errorsAccountPasskeyAuthFailed' };
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

/**
 * Full sign-in-with-passkey flow shared by /login and /signup: flips the
 * caller's busy flag, navigates home on success, toasts the localized error
 * otherwise (silent on user cancellation). `deps` are injectable for tests.
 */
export async function signInWithPasskey(
  setBusy: (v: boolean) => void,
  deps: {
    authenticate?: typeof authenticateWithPasskey;
    navigate?: typeof goto;
    showError?: (message: string) => void;
  } = {}
): Promise<void> {
  const authenticate = deps.authenticate ?? authenticateWithPasskey;
  const navigate = deps.navigate ?? goto;
  // svelte-sonner is imported lazily (like @simplewebauthn/browser above):
  // its nested runed dependency only exports the `svelte` condition, which
  // the unit-test runner doesn't set, so a static import would fail to
  // resolve in tests even when mocked.
  const showError =
    deps.showError ??
    ((message: string) =>
      void import('svelte-sonner')
        .then(({ toast }) => void toast.error(message))
        /* v8 ignore next 4 : chunk-load failure isn't reproducible in unit tests */
        .catch(() => {
          // Toast chunk failed to load (likely the same network blip that
          // failed the ceremony) — nothing better to do than stay silent.
        }));
  setBusy(true);
  try {
    const result = await authenticate();
    if (result.ok) {
      // localizedHref so an EN visitor lands on /en, not the FR home. The
      // navigation-without-resolve rule is off for .svelte files (where every
      // other goto lives); this path is locale-resolved by localizedHref.
      // eslint-disable-next-line svelte/no-navigation-without-resolve
      await navigate(localizedHref('/'), { invalidateAll: true });
      return;
    }
    if (result.errorKey !== null) {
      showError(m[result.errorKey]());
    }
  } finally {
    setBusy(false);
  }
}
