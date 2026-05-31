import { error, json } from '@sveltejs/kit';
import {
  PASSKEY_CHALLENGE_COOKIE,
  RP_ID,
  consumeChallenge,
  finishRegistration,
  isOriginAllowedForRPID,
  publicPasskey
} from '$lib/server/passkeys';
import { requireUser } from '$lib/server/guards';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies, request, url }) => {
  const user = requireUser(locals);
  if (!isOriginAllowedForRPID(url.origin)) {
    throw error(500, 'Configuration WebAuthn invalide pour cet hôte.');
  }

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

  const name = typeof body.name === 'string' ? body.name : 'Passkey';

  const result = await finishRegistration({
    userId: user.id,
    response: body.response as Parameters<typeof finishRegistration>[0]['response'],
    expectedChallenge: challenge.challenge,
    // expectedOrigin must match what the browser sent (the page's origin),
    // which is the per-request URL — preserved by adapter-node when
    // PROTOCOL_HEADER + HOST_HEADER are set. expectedRPID is the stable
    // registrable domain so previews + prod share one passkey universe.
    expectedOrigin: url.origin,
    expectedRPID: RP_ID,
    name
  });

  if (!result.ok) {
    return json({ ok: false, error: result.error }, { status: 400 });
  }

  audit({ type: 'account.passkey_added', userId: user.id, passkeyId: result.passkey.id });
  return json({ ok: true, passkey: publicPasskey(result.passkey) });
};
