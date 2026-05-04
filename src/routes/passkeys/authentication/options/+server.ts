import { json } from '@sveltejs/kit';
import {
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_CHALLENGE_TTL_MS,
  buildAuthenticationOptions,
  createChallenge,
  rpIdFromOrigin
} from '$lib/server/passkeys';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, url }) => {
  const origin = process.env.ORIGIN ?? url.origin;
  const rpID = rpIdFromOrigin(origin);

  const options = await buildAuthenticationOptions({ rpID });

  const stored = createChallenge({
    challenge: options.challenge,
    purpose: 'authentication',
    userId: null
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
