import { error, json } from '@sveltejs/kit';
import {
  PASSKEY_CHALLENGE_COOKIE,
  consumeChallenge,
  finishRegistration,
  originFromEnv,
  publicPasskey,
  rpIdFromOrigin
} from '$lib/server/passkeys';
import { requireUser } from '$lib/server/guards';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies, request, url }) => {
  const user = requireUser(locals);

  let body: { response?: unknown; name?: unknown };
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

  const challenge = await consumeChallenge(token, 'registration');
  if (!challenge || challenge.userId !== user.id) {
    throw error(400, 'Challenge expiré ou invalide');
  }

  const origin = originFromEnv(url.origin);
  const rpID = rpIdFromOrigin(origin);
  const name = typeof body.name === 'string' ? body.name : 'Passkey';

  const result = await finishRegistration({
    userId: user.id,
    response: body.response as Parameters<typeof finishRegistration>[0]['response'],
    expectedChallenge: challenge.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    name
  });

  if (!result.ok) {
    return json({ ok: false, error: result.error }, { status: 400 });
  }

  audit({ type: 'account.passkey_added', userId: user.id, passkeyId: result.passkey.id });
  return json({ ok: true, passkey: publicPasskey(result.passkey) });
};
