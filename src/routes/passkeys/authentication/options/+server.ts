import { error, json } from '@sveltejs/kit';
import {
  PASSKEY_CHALLENGE_AUTOFILL_COOKIE,
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_CHALLENGE_TTL_MS,
  RP_ID,
  buildAuthenticationOptions,
  createChallenge
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

// Conditional UI fires this endpoint automatically on every /login page view,
// so it must not share the modal flow's bucket : otherwise a user reloading
// the login page a couple dozen times would lock themselves (and anyone on the
// same IP) out of explicit passkey sign-in. The autofill cap is set higher
// because legitimate page-load volume is higher than user-initiated clicks.
const PASSKEY_AUTOFILL_OPTIONS_LIMIT = {
  name: 'passkey-auth-options-autofill',
  limit: 60,
  windowMs: 5 * 60 * 1000
};

export const POST: RequestHandler = async (event) => {
  const { cookies, request } = event;

  // Body is optional : conditional-UI clients send {"mode":"autofill"} so the
  // server can route to the autofill cookie + bucket. Legacy / modal clients
  // POST with no body, in which case we fall through to the standard path.
  let mode: 'modal' | 'autofill' = 'modal';
  if (request.headers.get('content-type')?.includes('application/json')) {
    try {
      const body = (await request.json()) as { mode?: unknown };
      if (body?.mode === 'autofill') mode = 'autofill';
    } catch {
      // Malformed JSON falls back to modal; the verify step will reject any
      // assertion that doesn't match a real challenge anyway.
    }
  }

  const ip = clientKey(event);
  const bucket = mode === 'autofill' ? PASSKEY_AUTOFILL_OPTIONS_LIMIT : PASSKEY_OPTIONS_LIMIT;
  const rl = checkRateLimit(bucket, ip);
  if (!rl.allowed) {
    throw error(429, `Trop de tentatives. Réessayez dans ${rl.retryAfterSeconds}s.`);
  }

  const options = await buildAuthenticationOptions({ rpID: RP_ID });

  const stored = await createChallenge({
    challenge: options.challenge,
    purpose: 'authentication',
    userId: null
  });

  const cookieName =
    mode === 'autofill' ? PASSKEY_CHALLENGE_AUTOFILL_COOKIE : PASSKEY_CHALLENGE_COOKIE;
  cookies.set(cookieName, stored.token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(PASSKEY_CHALLENGE_TTL_MS / 1000)
  });

  return json(options);
};
