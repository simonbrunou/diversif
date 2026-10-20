/**
 * Whether `typed` is the account's email, ignoring surrounding spaces and
 * case. Shared by the account/delete action and its page's button check so
 * the two can't drift apart.
 *
 * Lowercase both sides: signup normalises to lowercase before insert, but
 * the DB column has no CITEXT/CHECK constraint forcing it, so any account
 * that ever bypassed signup (manual import, future paths) could have a
 * mixed-case email and be locked out of its own deletion.
 */
export function matchesAccountEmail(typed: string, accountEmail: string): boolean {
  return typed.trim().toLowerCase() === accountEmail.toLowerCase();
}
