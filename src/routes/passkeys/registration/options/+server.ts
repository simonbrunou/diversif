import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_CHALLENGE_TTL_MS,
  buildRegistrationOptions,
  createChallenge,
  originFromEnv,
  rpIdFromOrigin
} from '$lib/server/passkeys';
import { requireUser } from '$lib/server/guards';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies, url }) => {
  const safe = requireUser(locals);
  const fresh = db.select().from(users).where(eq(users.id, safe.id)).get();
  if (!fresh) throw error(401, 'Utilisateur introuvable');

  const origin = originFromEnv(url.origin);
  const rpID = rpIdFromOrigin(origin);

  const options = await buildRegistrationOptions({
    userId: fresh.id,
    email: fresh.email,
    displayName: fresh.displayName,
    rpID
  });

  const stored = createChallenge({
    challenge: options.challenge,
    purpose: 'registration',
    userId: fresh.id
  });

  cookies.set(PASSKEY_CHALLENGE_COOKIE, stored.token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(PASSKEY_CHALLENGE_TTL_MS / 1000)
  });

  return json(options);
};
