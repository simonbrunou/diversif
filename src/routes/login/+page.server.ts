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
import { isE2E } from '$lib/server/e2e';
import type { Actions, PageServerLoad } from './$types';

// Per-IP login ceiling. Since #302, every e2e signup also drives a real
// login (the extra step that closed the signup email-enumeration oracle —
// see signup/+page.server.ts), so the suite now legitimately submits this
// action ~1:1 with every signup instead of rarely. Relax it the same way
// signup/+page.server.ts's SIGNUP_LIMIT already does : isE2E() requires
// both E2E=1 (set in playwright.config.ts) and a loopback ORIGIN, so a
// stray E2E=1 on a real deployment keeps the strict 10/5min ceiling.
const LOGIN_LIMIT = {
  name: 'login',
  /* v8 ignore next : E2E branch covered by the Playwright suite */
  limit: isE2E() ? 500 : 10,
  windowMs: 5 * 60 * 1000
};
// Second bucket keyed on the TARGETED account (normalized email), so a
// distributed credential-stuffing run rotating through many IPs still can't
// hammer one mailbox past 20 FAILED attempts/hour. The bucket is keyed on
// whatever email was submitted — registered or not — so tripping it reveals
// nothing about whether the address is on file. Only failures are recorded
// (peeked once, actioned only if the same request's password also turns
// out wrong — see the action below): counting every POST would spend the
// budget on legitimate successful logins for no reason, and gating the
// 429 on the peek alone (regardless of the submitted password) would let
// anyone who merely knows the address lock the real owner out of password
// login with junk guesses. Once tripped, further WRONG guesses are
// throttled, but a correct password from the genuine owner always
// succeeds (#301).
const LOGIN_EMAIL_LIMIT = { name: 'login-email', limit: 20, windowMs: 60 * 60 * 1000 };

const schema = z.object({
  // .max(254) bounds the attacker-chosen key space: the e-mail is the
  // per-account rate-limit bucket key (and 254 octets is the RFC 5321 cap
  // for a deliverable address anyway).
  email: z.email('Adresse e-mail invalide').max(254, 'Adresse e-mail invalide'),
  password: z.string().min(1, 'Mot de passe requis')
});

// Post-login destination override, set by signup/+page.server.ts when an
// invite targeted a child (?next=/child/<id>) so a user who just redeemed
// an invite lands there instead of the generic home after this extra login
// step (see #302). `next` is attacker-influenceable (anyone can put any
// value in the query string of a page with no auth requirement), so it's
// checked against a strict allowlist — never used verbatim — to rule out
// an open redirect to an off-site or unexpected same-origin URL.
const NEXT_PATH_RE = /^\/child\/\d+$/;
function safeNextPath(url: URL): string {
  const next = url.searchParams.get('next');
  return next !== null && NEXT_PATH_RE.test(next) ? next : '/';
}

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
    // PEEK only, and — unlike the per-IP check above — deliberately NOT
    // actioned yet: it's only applied below if THIS request's password also
    // turns out wrong (#301), so a tripped bucket can never block a correct
    // password from the genuine owner. Peeking here (a cheap in-memory
    // lookup) rather than after verifyPasswordOrDecoy costs nothing
    // measurable next to an Argon2id hash either way; verification always
    // runs regardless of the peek result, so its wall-clock cost can't be
    // used to tell a hot bucket from a cold one.
    const emailKey = email.toLowerCase();
    const emailRl = peekRateLimit(LOGIN_EMAIL_LIMIT, emailKey);

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
      // The bucket was already saturated with prior wrong guesses AND this
      // guess is also wrong: 429, matching the per-IP failure body exactly
      // (same status, same keys, same empty email echo) so the response
      // can't be used to distinguish which bucket tripped or whether the
      // account exists.
      if (!emailRl.allowed) {
        return fail(429, {
          email: '',
          errorKey: 'errorsAuthRateLimited'
        });
      }
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

    throw localizedRedirect(event.locals.locale, 303, safeNextPath(event.url));
  }
};
