import { eq } from 'drizzle-orm';
import { fail, type ActionFailure } from '@sveltejs/kit';
import { db } from './db';
import { users } from './db/schema';
import { checkRateLimit } from './rate-limit';
import { verifyPassword } from './auth';
import type { SafeUser } from '$lib/types';

// Shared across all currentPassword-gated surfaces (change password, delete
// account, delete child). Keyed on user.id so the budget follows the threat
// (a session-cookie attacker) rather than their IP. 5 attempts per 5 minutes
// matches the limits already declared in each call site.
const FRESH_AUTH_LIMIT = { name: 'fresh-auth', limit: 5, windowMs: 5 * 60 * 1000 } as const;

type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/**
 * Verify that the user has supplied their current password correctly.
 * Centralizes the rate-limit + password verify pattern shared by:
 *   - /account/password (changePassword action)
 *   - /account (deleteAccount action, if present)
 *   - /child/[id]/settings (deleteChild action)
 *
 * @param user        The authenticated SafeUser (from requireUser / requireMembership).
 * @param currentPassword  The raw password string from the form.
 * @param rateLimitKey     A stable per-user key for the rate limiter (typically String(user.id)).
 *
 * Returns `{ ok: true, value: true }` on success, or
 * `{ ok: false, error: ActionFailure }` on rate-limit hit or wrong password.
 *
 * Throws a plain Error if the DB row for the user has no passwordHash — this
 * is an invariant violation for an authenticated user and should not be caught
 * as a validation failure.
 */
export async function requireFreshAuth(
  user: SafeUser,
  currentPassword: string,
  rateLimitKey: string = String(user.id)
): Promise<Result<true, ActionFailure<{ error: string }>>> {
  const rl = checkRateLimit(FRESH_AUTH_LIMIT, rateLimitKey);
  if (!rl.allowed) {
    return {
      ok: false,
      error: fail(429, { error: 'Trop de tentatives. Réessayez plus tard.' })
    };
  }

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row?.passwordHash) {
    throw new Error(`requireFreshAuth: user ${user.id} has no password hash`);
  }

  const valid = await verifyPassword(row.passwordHash, currentPassword);
  if (!valid) {
    return { ok: false, error: fail(400, { error: 'Mot de passe incorrect.' }) };
  }

  return { ok: true, value: true };
}

/**
 * Like `requireFreshAuth`, but returns failures shaped as
 * `{ [field]: <message-key> }` (consumed by `resolveMessageKey()` on the
 * client) and accepts an `onMissingUser` callback so the caller can localize
 * the redirect when the DB user row has gone (rare race after revocation).
 *
 * Usage:
 *   const fresh = await requireFreshAuthWithKey(user, currentPassword, {
 *     field: 'passwordErrorKey',
 *     rateLimitedKey: 'errorsAuthRateLimited',
 *     incorrectKey: 'errorsAccountPasswordIncorrect',
 *     onMissingUser: () => { throw localizedRedirect(locale, 303, '/login'); }
 *   });
 *   if (!fresh.ok) return fresh.failure;
 */
export async function requireFreshAuthWithKey<TField extends string>(
  user: SafeUser,
  currentPassword: string,
  opts: {
    field: TField;
    rateLimitedKey: string;
    incorrectKey: string;
    onMissingUser?: () => never;
    rateLimitKey?: string;
  }
): Promise<{ ok: true } | { ok: false; failure: ActionFailure<Record<TField, string>> }> {
  const rateLimitKey = opts.rateLimitKey ?? String(user.id);
  const rl = checkRateLimit(FRESH_AUTH_LIMIT, rateLimitKey);
  if (!rl.allowed) {
    return {
      ok: false,
      failure: fail(429, { [opts.field]: opts.rateLimitedKey } as Record<TField, string>)
    };
  }

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);

  if (!row?.passwordHash) {
    if (opts.onMissingUser) opts.onMissingUser();
    throw new Error(`requireFreshAuthWithKey: user ${user.id} has no password hash`);
  }

  const valid = await verifyPassword(row.passwordHash, currentPassword);
  if (!valid) {
    return {
      ok: false,
      failure: fail(400, { [opts.field]: opts.incorrectKey } as Record<TField, string>)
    };
  }

  return { ok: true };
}
