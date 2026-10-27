// Shared use:enhance helpers.
//
// `trackSubmission` backs every enhanced form in the app: the account pages
// (password/profile/passkeys/delete), child settings, login, signup, join/[code],
// ConfirmModal and AddSymptomSheet — each previously declared a diverging
// inline closure. The repas forms (log, edit) don't use use:enhance: they
// submit through RepasForm.svelte and the durable submit module.
//
// `resolveMessageKey` turns an action- or load-returned key into prose: inside
// FormError, whose `messageKey` prop renders the action refusals of login,
// signup, the account pages (profile, password, passkeys, delete), child
// settings, the repas forms and join/[code]; inside FormSuccess, for the
// account pages' and child settings' success messages; in the dialogs of
// account/passkeys and child settings; in join/[code]'s load-error
// paragraph; and in the passkeys/registration/options endpoint (fresh-auth
// failures).

import * as m from '#lib/paraglide/messages.js';

/**
 * Wraps a use:enhance callback so a `submitting` state flag is flipped on
 * before submit and off when the server response has been applied (in a
 * finally, so a failed update can't leave a button stuck disabled). Use it
 * like `use:enhance={trackSubmission((v) => (saving = v))}`.
 *
 * Options cover the recurring overlay-form shapes so call sites don't
 * hand-roll diverging closures:
 * - `beforeSubmit` — return false to cancel before the request leaves.
 * - `reset: false` — keep typed values after a validation failure.
 * - `onSuccess` — runs BEFORE update() applies a success/redirect result,
 *   so overlays close before the refreshed page renders under them. It
 *   receives the result type: close on 'success', but consider staying
 *   open on 'redirect' so a loading state covers the navigation.
 * - `onFailure` — runs after a failure/error result has been applied.
 */
export function trackSubmission(
  setter: (v: boolean) => void,
  opts: {
    reset?: boolean;
    beforeSubmit?: () => boolean;
    onSuccess?: (resultType: 'success' | 'redirect') => void;
    onFailure?: () => void;
  } = {}
) {
  return ({ cancel }: { cancel: () => void }) => {
    if (opts.beforeSubmit && !opts.beforeSubmit()) {
      cancel();
      return;
    }
    setter(true);
    return async ({
      result,
      update
    }: {
      result: { type: string };
      update: (o?: { reset?: boolean }) => Promise<void>;
    }) => {
      const succeeded = result.type === 'success' || result.type === 'redirect';
      if (succeeded) opts.onSuccess?.(result.type as 'success' | 'redirect');
      try {
        await update(opts.reset === false ? { reset: false } : undefined);
      } finally {
        setter(false);
      }
      if (!succeeded) opts.onFailure?.();
    };
  };
}

/**
 * Resolve a paraglide message key by string. Used when a server action
 * returns a key (e.g. `form.profileSuccessKey = 'errorsAccountProfileSuccess'`)
 * that the page needs to show inline or in a dialog. An
 * unknown key gets a generic message instead of `undefined`. A key is
 * unknown when server code mistypes it, or when a tab still runs a bundle
 * built before the key (see the i18n-add-key skill's pitfalls).
 */
export function resolveMessageKey(key: string): string {
  const fn = m[key as keyof typeof m] as (() => string) | undefined;
  return fn?.() ?? m.errorsGenericFallback();
}
