// Message-key lookup for action and load results.
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
 * Resolve a paraglide message key by string, such as the one a server action
 * returns in `{ profileSuccessKey: 'errorsAccountProfileSuccess' }`. An
 * unknown key gets a generic message instead of `undefined`. A key is
 * unknown when server code mistypes it, or when a tab still runs a bundle
 * built before the key (see the i18n-add-key skill's pitfalls).
 */
export function resolveMessageKey(key: string): string {
  const fn = m[key as keyof typeof m] as (() => string) | undefined;
  return fn?.() ?? m.errorsGenericFallback();
}
