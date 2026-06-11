// Shared use:enhance helpers.
//
// `trackSubmission` consumers (4): account/password, account/profile,
// account/delete, child/[id]/settings — each previously declared the same
// closure inline.
//
// `resolveMessageKey` consumers (3): form-toasts.svelte.ts (which surfaces
// action-returned keys via toast for the account pages) and the login/signup
// passkey call sites (which surface the errorKey returned by
// authenticateWithPasskey).

import * as m from '$lib/paraglide/messages';

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
 *   so overlays close before the refreshed page renders under them.
 * - `onFailure` — runs after a failure/error result has been applied.
 */
export function trackSubmission(
  setter: (v: boolean) => void,
  opts: {
    reset?: boolean;
    beforeSubmit?: () => boolean;
    onSuccess?: () => void;
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
      if (succeeded) opts.onSuccess?.();
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
 * that the page needs to surface via toast.success/error. Falls back to a
 * generic message if the key is unknown — should never happen in practice
 * but keeps the toast from rendering `undefined`.
 */
export function resolveMessageKey(key: string): string {
  const fn = m[key as keyof typeof m] as (() => string) | undefined;
  return fn?.() ?? /* v8 ignore next */ m.errorsGenericFallback();
}
