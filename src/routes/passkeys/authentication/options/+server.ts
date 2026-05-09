import { error, json } from '@sveltejs/kit';
import {
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_CHALLENGE_TTL_MS,
  buildAuthenticationOptions,
  createChallenge,
  originFromEnv,
  rpIdFromOrigin
} from '$lib/server/passkeys';
import { checkRateLimit, clientKey } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

// The endpoint is unauthenticated (a visitor needs a fresh challenge before
// they can prove possession of a passkey), so without a per-IP limit an
// attacker could fire it in a loop and grow webauthn_challenges arbitrarily
// until the next runCleanup tick. Mirror the verify endpoint's bucket.
const PASSKEY_OPTIONS_LIMIT = {
  name: 'passkey-auth-options',
  limit: 20,
  windowMs: 5 * 60 * 1000
};

export const POST: RequestHandler = async (event) => {
  const { cookies, url } = event;
  const ip = clientKey(event);
  const rl = checkRateLimit(PASSKEY_OPTIONS_LIMIT, ip);
  if (!rl.allowed) {
    throw error(429, `Trop de tentatives. Réessayez dans ${rl.retryAfterSeconds}s.`);
  }

  const origin = originFromEnv(url.origin);
  const rpID = rpIdFromOrigin(origin);

  const options = await buildAuthenticationOptions({ rpID });

  const stored = await createChallenge({
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
