import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  createSession,
  findUserByEmail,
  setSessionCookie,
  verifyPasswordOrDecoy
} from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { audit } from '$lib/server/audit';
import { requireGuest } from '$lib/server/guards';
import { parseFormWithKey } from '$lib/server/forms';
import { checkRateLimit, clientKey, peekRateLimit, recordAttempt } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

const LOGIN_LIMIT = { name: 'login', limit: 10, windowMs: 5 * 60 * 1000 };
// Second bucket keyed on the TARGETED account (normalized email), so a
// distributed credential-stuffing run rotating through many IPs still can't
// hammer one mailbox past 20 FAILED attempts/hour. The bucket is keyed on
// whatever email was submitted — registered or not — so tripping it reveals
// nothing about whether the address is on file. Only failures are recorded
// (peek before verification, record on failure): counting every POST would
// let 20 successful logins lock the account, and would let anyone who knows
// the address lock its password login with junk POSTs.
const LOGIN_EMAIL_LIMIT = { name: 'login-email', limit: 20, windowMs: 60 * 60 * 1000 };

const schema = z.object({
  // .max(254) bounds the attacker-chosen key space: the e-mail is the
  // per-account rate-limit bucket key (and 254 octets is the RFC 5321 cap
  // for a deliverable address anyway).
  email: z.string().max(254, 'Adresse e-mail invalide').email('Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis')
});

export const load: PageServerLoad = async ({ locals }) => {
  requireGuest(locals);
  return {};
};

export const actions: Actions = {
  default: async (event) => {
    const { request, cookies } = event;
    const ip = clientKey(event);
    const rl = checkRateLimit(LOGIN_LIMIT, ip);
    if (!rl.allowed) {
      return fail(429, {
        email: '',
        errorKey: 'errorsAuthRateLimited'
      });
    }

    const parsed = await parseFormWithKey(request, schema, {
      field: 'errorKey',
      badInputKey: 'errorsAuthBadInput',
      echo: ['email']
    });
    if (!parsed.ok) return parsed.failure;

    const { email, password } = parsed.data;

    // Per-account throttle, checked in addition to the per-IP bucket above.
    // PEEK only — the attempt is recorded further down, and only when
    // authentication fails. The failure body is byte-identical to the
    // per-IP 429 — same status, same keys, same empty email echo — so the
    // response can't be used to distinguish which bucket tripped (or
    // whether the account exists).
    const emailKey = email.toLowerCase();
    const emailRl = peekRateLimit(LOGIN_EMAIL_LIMIT, emailKey);
    if (!emailRl.allowed) {
      return fail(429, {
        email: '',
        errorKey: 'errorsAuthRateLimited'
      });
    }

    const user = await findUserByEmail(email);
    // verifyPasswordOrDecoy keeps the wall-clock time identical between the
    // "no such email" and "wrong password" branches so an unauthenticated
    // visitor can't probe which addresses are registered via response timing.
    const valid = await verifyPasswordOrDecoy(user?.passwordHash, password);

    if (!user || !valid) {
      // Only FAILURES consume the per-email budget: lockout must come from
      // failed guesses, never from legitimate successful logins.
      recordAttempt(LOGIN_EMAIL_LIMIT, emailKey);
      audit({ type: 'auth.login_failed', method: 'password' });
      return fail(400, {
        email,
        errorKey: 'errorsAuthInvalidCredentials'
      });
    }

    // Intentionally do NOT reset the per-IP bucket on success: an attacker
    // with a single valid credential could otherwise alternate failed
    // guesses against other accounts with periodic successful logins of
    // their own and keep the throttle at zero indefinitely. The 10/5min
    // window is wide enough that a legitimate user who mistyped a few times
    // before getting it right won't be locked out. (The per-email bucket
    // never counted this success in the first place.)

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    const { token } = await createSession(user.id);
    setSessionCookie(cookies, token);
    audit({ type: 'auth.login_succeeded', userId: user.id, method: 'password' });

    throw localizedRedirect(event.locals.locale, 303, '/');
  }
};
