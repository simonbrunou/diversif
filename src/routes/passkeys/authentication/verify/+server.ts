import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import {
  PASSKEY_CHALLENGE_COOKIE,
  consumeChallenge,
  finishAuthentication,
  originFromEnv,
  rpIdFromOrigin
} from '$lib/server/passkeys';
import { SESSION_COOKIE, SESSION_DURATION_MS, createSession } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { checkRateLimit, clientKey } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

const PASSKEY_LIMIT = { name: 'passkey-auth', limit: 20, windowMs: 5 * 60 * 1000 };

export const POST: RequestHandler = async (event) => {
  const { cookies, request, url } = event;
  const ip = clientKey(event);
  const rl = checkRateLimit(PASSKEY_LIMIT, ip);
  if (!rl.allowed) {
    throw error(429, `Trop de tentatives. Réessayez dans ${rl.retryAfterSeconds}s.`);
  }

  let body: { response?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'JSON invalide');
  }
  if (!body.response || typeof body.response !== 'object') {
    throw error(400, 'Réponse manquante');
  }

  const token = cookies.get(PASSKEY_CHALLENGE_COOKIE) ?? '';
  cookies.delete(PASSKEY_CHALLENGE_COOKIE, { path: '/' });

  const challenge = consumeChallenge(token, 'authentication');
  if (!challenge) {
    throw error(400, 'Challenge expiré ou invalide');
  }

  const origin = originFromEnv(url.origin);
  const rpID = rpIdFromOrigin(origin);

  const result = await finishAuthentication({
    response: body.response as Parameters<typeof finishAuthentication>[0]['response'],
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID
  });

  if (!result.ok) {
    return json({ ok: false, error: result.error }, { status: 400 });
  }

  // Intentionally do NOT reset the bucket on success — see the matching
  // comment in src/routes/login/+page.server.ts. Resetting on success lets
  // an attacker with one valid credential keep the throttle defeated by
  // alternating failed guesses with their own occasional successful auth.

  db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, result.userId)).run();

  const session = createSession(result.userId);
  cookies.set(SESSION_COOKIE, session.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SESSION_DURATION_MS / 1000)
  });

  return json({ ok: true });
};
