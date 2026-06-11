// Shared "surface the form action result as a toast" effect.
//
// Consumers (4): account/profile, account/password, account/delete,
// account/passkeys — each previously copy-pasted the same lastFormSeen
// $effect with only the field names differing.

import { toast } from 'svelte-sonner';
import { resolveMessageKey } from './tracked-enhance';

/** Union-distributed string keys, so each page's ActionData field names check. */
type KeysOf<F> = F extends unknown ? Extract<keyof NonNullable<F>, string> : never;

/**
 * Registers an `$effect` (must be called during component init) that toasts
 * the paraglide key a form action returned. Identity-based deduplication:
 * the same `form` object is only surfaced once, so unrelated reruns of the
 * effect cannot re-fire the toast.
 *
 * Usage: `createFormToasts(() => form, { successKey: 'profileSuccessKey', errorKey: 'profileErrorKey' })`
 */
export function createFormToasts<F>(
  getForm: () => F,
  keys: { successKey?: KeysOf<F>; errorKey?: KeysOf<F> }
): void {
  let lastFormSeen: F | undefined;
  $effect(() => {
    const form = getForm();
    if (form === lastFormSeen) return;
    lastFormSeen = form;
    if (!form) return;
    const record = form as Record<string, unknown>;
    const successKey = keys.successKey ? record[keys.successKey] : undefined;
    if (typeof successKey === 'string') toast.success(resolveMessageKey(successKey));
    const errorKey = keys.errorKey ? record[keys.errorKey] : undefined;
    if (typeof errorKey === 'string') toast.error(resolveMessageKey(errorKey));
  });
}
