import { error, json } from '@sveltejs/kit';
import {
  PASSKEY_CHALLENGE_COOKIE,
  RP_ID,
  assertRpidOrigin,
  consumeChallenge,
  finishRegistration,
  parsePasskeyResponseBody,
  publicPasskey
} from '$lib/server/passkeys';
import { requireUser } from '$lib/server/guards';
import { audit } from '$lib/server/audit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies, request, url }) => {
  const user = requireUser(locals);
  assertRpidOrigin(url.origin);

  const { response, name: rawName } = await parsePasskeyResponseBody(request);

  const token = cookies.get(PASSKEY_CHALLENGE_COOKIE) ?? '';
  cookies.delete(PASSKEY_CHALLENGE_COOKIE, { path: '/' });

  const challenge = await consumeChallenge(token, 'registration');
  if (!challenge || challenge.userId !== user.id) {
    throw error(400, 'Challenge expiré ou invalide');
  }

  const name = typeof rawName === 'string' ? rawName : 'Passkey';

  const result = await finishRegistration({
    userId: user.id,
    response: response as Parameters<typeof finishRegistration>[0]['response'],
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
