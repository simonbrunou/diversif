import { error, json } from '@sveltejs/kit';
import {
  PASSKEY_CHALLENGE_COOKIE,
  consumeChallenge,
  finishAuthentication,
  rpIdFromOrigin
} from '$lib/server/passkeys';
import { SESSION_COOKIE, SESSION_DURATION_MS, createSession } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, request, url }) => {
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

  const origin = process.env.ORIGIN ?? url.origin;
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
