import { error } from '@sveltejs/kit';
import {
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_CHALLENGE_TTL_MS,
  RP_ID,
  buildRegistrationOptions,
  createChallenge,
  isOriginAllowedForRPID
} from '#lib/server/passkeys.js';
import { requireUser } from '#lib/server/guards.js';
import { requireFreshAuth } from '#lib/server/fresh-auth.js';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies, request, url }) => {
  const user = requireUser(locals);
  if (!isOriginAllowedForRPID(url.origin)) {
    throw error(500, 'Configuration WebAuthn invalide pour cet hôte.');
  }

  let body: { currentPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Mot de passe requis.' }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  if (!currentPassword) {
    return Response.json({ ok: false, error: 'Mot de passe requis.' }, { status: 400 });
  }

  const freshAuth = await requireFreshAuth(locals, currentPassword, 'error');
  if (!freshAuth.ok) {
    return Response.json(
      { ok: false, error: freshAuth.failure.data.error },
      { status: freshAuth.failure.status }
    );
  }

  const options = await buildRegistrationOptions({
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    rpID: RP_ID
  });

  const stored = await createChallenge({
    challenge: options.challenge,
    purpose: 'registration',
    userId: user.id
  });

  cookies.set(PASSKEY_CHALLENGE_COOKIE, stored.token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(PASSKEY_CHALLENGE_TTL_MS / 1000)
  });

  return Response.json(options);
};
