import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  createSession,
  findUserByEmail,
  verifyPassword
} from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { requireGuest } from '$lib/server/guards';
import { checkRateLimit, clientKey } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

const LOGIN_LIMIT = { name: 'login', limit: 10, windowMs: 5 * 60 * 1000 };

const schema = z.object({
  email: z.string().email('Email invalide'),
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

    const data = Object.fromEntries(await request.formData());
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
      return fail(400, {
        email: typeof data.email === 'string' ? data.email : /* v8 ignore next */ '',
        errorKey: 'errorsAuthBadInput'
      });
    }

    const { email, password } = parsed.data;
    const user = findUserByEmail(email);
    const valid = user ? await verifyPassword(user.passwordHash, password) : false;

    if (!user || !valid) {
      return fail(400, {
        email,
        errorKey: 'errorsAuthInvalidCredentials'
      });
    }

    // Intentionally do NOT reset the bucket on success: an attacker with a
    // single valid credential could otherwise alternate failed guesses
    // against other accounts with periodic successful logins of their own
    // and keep the throttle at zero indefinitely. The 10/5min window is
    // wide enough that a legitimate user who mistyped a few times before
    // getting it right won't be locked out.

    db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id)).run();

    const session = createSession(user.id);
    cookies.set(SESSION_COOKIE, session.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: Math.floor(SESSION_DURATION_MS / 1000)
    });

    throw redirect(303, '/');
  }
};
