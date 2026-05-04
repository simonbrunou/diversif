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
import type { Actions, PageServerLoad } from './$types';

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis')
});

export const load: PageServerLoad = async ({ locals }) => {
  requireGuest(locals);
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const data = Object.fromEntries(await request.formData());
    const parsed = schema.safeParse(data);

    if (!parsed.success) {
      return fail(400, {
        email: typeof data.email === 'string' ? data.email : /* v8 ignore next */ '',
        error: parsed.error.issues[0]?.message ?? /* v8 ignore next */ 'Champs invalides'
      });
    }

    const { email, password } = parsed.data;
    const user = findUserByEmail(email);
    const valid = user ? await verifyPassword(user.passwordHash, password) : false;

    if (!user || !valid) {
      return fail(400, {
        email,
        error: 'Email ou mot de passe incorrect.'
      });
    }

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
