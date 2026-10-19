import { eq } from 'drizzle-orm';
import { fail, type ActionFailure } from '@sveltejs/kit';
import { db } from './db';
import { users } from './db/schema';
import { checkRateLimit } from './rate-limit';
import { verifyPassword } from './auth';
import { requireUser } from './guards';
import { localizedRedirect } from './redirect';

// Shared across all currentPassword-gated surfaces. Keyed on user.id so the
// budget follows the threat (a session-cookie attacker) rather than their IP.
const FRESH_AUTH_LIMIT = { name: 'fresh-auth', limit: 5, windowMs: 5 * 60 * 1000 } as const;

/**
 * Require the signed-in user to re-enter their current password before a
 * sensitive action, so a stolen session cookie alone isn't enough.
 *
 * Failures come back as `{ [field]: <message-key> }` for `resolveMessageKey()`
 * on the client: 429 `errorsAuthRateLimited` past 5 attempts in 5 minutes
 * (per user), 400 `errorsAccountPasswordIncorrect` on a wrong password.
 * Redirects to the localized /login, like `requireUser`, when nobody is
 * signed in or the user row vanished mid-session (rare race after deletion).
 *
 *   const fresh = await requireFreshAuth(locals, currentPassword, 'passwordErrorKey');
 *   if (!fresh.ok) return fresh.failure;
 */
export async function requireFreshAuth<TField extends string>(
  locals: App.Locals,
  currentPassword: string,
  field: TField
): Promise<{ ok: true } | { ok: false; failure: ActionFailure<Record<TField, string>> }> {
  const user = requireUser(locals);
  const failure = (status: number, key: string) => ({
    ok: false as const,
    failure: fail(status, { [field]: key } as Record<TField, string>)
  });

  if (!checkRateLimit(FRESH_AUTH_LIMIT, String(user.id)).allowed) {
    return failure(429, 'errorsAuthRateLimited');
  }

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row?.passwordHash) throw localizedRedirect(locals.locale, 303, '/login');

  if (!(await verifyPassword(row.passwordHash, currentPassword))) {
    return failure(400, 'errorsAccountPasswordIncorrect');
  }
  return { ok: true };
}
