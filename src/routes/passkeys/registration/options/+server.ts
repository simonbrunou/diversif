import { error, json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
  PASSKEY_CHALLENGE_COOKIE,
  PASSKEY_CHALLENGE_TTL_MS,
  RP_ID,
  buildRegistrationOptions,
  createChallenge,
  isOriginAllowedForRPID
} from '$lib/server/passkeys';
import { requireUser } from '$lib/server/guards';
import { requireFreshAuth } from '$lib/server/fresh-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies, request, url }) => {
  const safe = requireUser(locals);
  if (!isOriginAllowedForRPID(url.origin)) {
    throw error(500, 'Configuration WebAuthn invalide pour cet hôte.');
  }

  let body: { currentPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Mot de passe requis.' }, { status: 400 });
  }

  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  if (!currentPassword) {
    return json({ ok: false, error: 'Mot de passe requis.' }, { status: 400 });
  }

  const freshAuth = await requireFreshAuth(safe, currentPassword, {
    onMissingUser: () => {
      throw error(401, 'Utilisateur introuvable');
    }
  });
  if (!freshAuth.ok) {
    return json(
      { ok: false, error: freshAuth.error.data.error },
      { status: freshAuth.error.status }
    );
  }

  const fresh = (await db.select().from(users).where(eq(users.id, safe.id)).limit(1))[0];
  if (!fresh) throw error(401, 'Utilisateur introuvable');

  const options = await buildRegistrationOptions({
    userId: fresh.id,
    email: fresh.email,
    displayName: fresh.displayName,
    rpID: RP_ID
  });

  const stored = await createChallenge({
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
