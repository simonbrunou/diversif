import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import {
  PASSKEY_CHALLENGE_AUTOFILL_COOKIE,
  PASSKEY_CHALLENGE_COOKIE,
  RP_ID,
  consumeChallenge,
  finishAuthentication,
  isOriginAllowedForRPID
} from '$lib/server/passkeys';
import { SESSION_COOKIE, SESSION_DURATION_MS, createSession } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { audit } from '$lib/server/audit';
import { checkRateLimit, clientKey } from '$lib/server/rate-limit';
import type { RequestHandler } from './$types';

const PASSKEY_LIMIT = { name: 'passkey-auth', limit: 20, windowMs: 5 * 60 * 1000 };

export const POST: RequestHandler = async (event) => {
  const { cookies, request, url } = event;
  if (!isOriginAllowedForRPID(url.origin)) {
    throw error(500, 'Configuration WebAuthn invalide pour cet hôte.');
  }

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

  // The client doesn't tell us which mode it took, so try both cookies. Both
  // are always cleared so a stale challenge from one flow can't survive into
  // the other's next attempt. consumeChallenge is a DELETE-RETURNING and
  // single-use, so at most one returns a row.
  const modalToken = cookies.get(PASSKEY_CHALLENGE_COOKIE) ?? '';
  const autofillToken = cookies.get(PASSKEY_CHALLENGE_AUTOFILL_COOKIE) ?? '';
  cookies.delete(PASSKEY_CHALLENGE_COOKIE, { path: '/' });
  cookies.delete(PASSKEY_CHALLENGE_AUTOFILL_COOKIE, { path: '/' });

  const challenge =
    (await consumeChallenge(modalToken, 'authentication')) ??
    (await consumeChallenge(autofillToken, 'authentication'));
  if (!challenge) {
    throw error(400, 'Challenge expiré ou invalide');
  }

  const result = await finishAuthentication({
    response: body.response as Parameters<typeof finishAuthentication>[0]['response'],
    expectedChallenge: challenge.challenge,
    // See registration/verify for the rationale on these two: per-request
    // origin comes from adapter-node (PROTOCOL_HEADER + HOST_HEADER) and
    // RP_ID is the registrable domain.
    expectedOrigin: url.origin,
    expectedRPID: RP_ID
  });

  if (!result.ok) {
    audit({ type: 'auth.login_failed', method: 'passkey' });
    return json({ ok: false, error: result.error }, { status: 400 });
  }

  // Intentionally do NOT reset the bucket on success : see the matching
  // comment in src/routes/login/+page.server.ts. Resetting on success lets
  // an attacker with one valid credential keep the throttle defeated by
  // alternating failed guesses with their own occasional successful auth.

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, result.userId));

  const { token } = await createSession(result.userId);
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SESSION_DURATION_MS / 1000)
  });
  audit({ type: 'auth.login_succeeded', userId: result.userId, method: 'passkey' });

  return json({ ok: true });
};
