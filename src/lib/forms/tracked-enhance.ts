// Shared use:enhance helpers. Five routes (login/signup are bespoke; account
// password/profile/passkeys/delete and child settings are the consumers) all
// previously declared the same trackSubmission/resolveMessageKey pair inline.
// Centralise here so the submit-loading state and i18n-key lookup pattern
// stay consistent.

import * as m from '$lib/paraglide/messages';

/**
 * Wraps a use:enhance callback so a `submitting` state flag is flipped on
 * before submit and off when the server response has been applied. Use it
 * like `use:enhance={trackSubmission((v) => (saving = v))}`.
 */
export function trackSubmission(setter: (v: boolean) => void) {
  return () => {
    setter(true);
    return async ({ update }: { update: () => Promise<void> }) => {
      await update();
      setter(false);
    };
  };
}

/**
 * Resolve a paraglide message key by string. Used when a server action
 * returns a key (e.g. `form.profileSuccessKey = 'errorsAccountProfileSuccess'`)
 * that the page needs to surface via toast.success/error. Falls back to a
 * generic message if the key is unknown — should never happen in practice
 * but keeps the toast from rendering `undefined`.
 */
export function resolveMessageKey(key: string): string {
  const fn = m[key as keyof typeof m] as (() => string) | undefined;
  return fn?.() ?? /* v8 ignore next */ m.errorsGenericFallback();
}
