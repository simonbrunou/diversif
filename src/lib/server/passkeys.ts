import { error } from '@sveltejs/kit';
import {
  generateKeyPairSync,
  randomBytes,
  verify as cryptoVerify,
  type KeyObject
} from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON
} from '@simplewebauthn/server';
import { db } from './db';
import { passkeys, webauthnChallenges, type Passkey } from './db/schema';

export const RP_NAME = 'Diversif';
/**
 * Stable WebAuthn Relying Party ID — a bare registrable domain, not a full
 * origin. The default keeps prod + `*.diversif.app` previews in one passkey
 * scope; self-hosted deployments must set WEBAUTHN_RP_ID to their own host
 * (for local Docker, `localhost`).
 */
const DEFAULT_RP_ID = 'diversif.app';

function resolveRPID(): string {
  const raw = process.env.WEBAUTHN_RP_ID?.trim();
  if (!raw) return DEFAULT_RP_ID;
  const rpID = raw.toLowerCase();
  if (
    rpID.includes('://') ||
    rpID.includes('/') ||
    rpID.includes(':') ||
    rpID.startsWith('.') ||
    rpID.endsWith('.')
  ) {
    throw new Error('WEBAUTHN_RP_ID must be a bare hostname such as diversif.app');
  }
  return rpID;
}

export const RP_ID = resolveRPID();

export function isOriginAllowedForRPID(origin: string, rpID: string = RP_ID): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return host === rpID || host.endsWith(`.${rpID}`);
  } catch {
    return false;
  }
}

/**
 * Guard shared by both WebAuthn verify endpoints: refuse a request whose origin
 * is outside the RP ID scope (a 500 — it means the host is misconfigured, not
 * that the user did anything wrong).
 */
export function assertRpidOrigin(origin: string): void {
  if (!isOriginAllowedForRPID(origin)) {
    throw error(500, 'Configuration WebAuthn invalide pour cet hôte.');
  }
}

/**
 * Parse + validate the JSON body shared by both verify endpoints. Returns the
 * ceremony `response` object (and the optional `name`, used only by
 * registration). Throws a 400 on malformed JSON or a missing response.
 */
export async function parsePasskeyResponseBody(
  request: Request
): Promise<{ response: object; name?: unknown }> {
  let body: { response?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'JSON invalide');
  }
  if (!body.response || typeof body.response !== 'object') {
    throw error(400, 'Réponse manquante');
  }
  return { response: body.response, name: body.name };
}
export const PASSKEY_CHALLENGE_COOKIE = 'wa_challenge';
// Conditional-UI ceremonies fire automatically on page load and would otherwise
// stomp on an in-flight registration/authentication challenge in another tab;
// they get their own cookie so the two flows can coexist.
export const PASSKEY_CHALLENGE_AUTOFILL_COOKIE = 'wa_challenge_autofill';
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Decoy ECDSA P-256 keypair (matches the curve simplewebauthn uses for ES256
// passkeys) generated lazily at first use, then warmed at module load in
// non-test runs so the FIRST production "no such credential" attempt doesn't
// pay the keygen cost on top of the verify cost. A single key is reused for
// the lifetime of the process.
// generateKeyPairSync('ec', …).publicKey is a KeyObject at runtime; annotate it
// as such. @types/node v25 widened the un-annotated return to a union
// (string | KeyObject | Buffer | JsonWebKey) that crypto.verify won't accept.
let decoyVerifyKey: KeyObject | null = null;
function timingDecoyVerify(): void {
  if (!decoyVerifyKey) {
    decoyVerifyKey = generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey;
  }
  /* v8 ignore start : node's crypto.verify throws on some malformed sigs
     and returns false on others; either path satisfies the timing goal */
  try {
    cryptoVerify('sha256', randomBytes(32), decoyVerifyKey, randomBytes(64));
  } catch {
    /* expected on malformed sig */
  }
  /* v8 ignore stop */
}
/* v8 ignore next 3 : module-load warming, skipped in tests by design */
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  timingDecoyVerify();
}

function newToken(): string {
  return randomBytes(32).toString('hex');
}

function bufferToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

function base64UrlToBuffer(value: string): Uint8Array<ArrayBuffer> {
  const src = Buffer.from(value, 'base64url');
  const buf = new ArrayBuffer(src.byteLength);
  const out = new Uint8Array(buf);
  out.set(src);
  return out;
}

export type StoredChallenge = {
  token: string;
  challenge: string;
  expiresAt: Date;
};

export async function purgeExpiredChallenges(now: Date = new Date()): Promise<void> {
  await db.delete(webauthnChallenges).where(lt(webauthnChallenges.expiresAt, now));
}

export async function createChallenge(opts: {
  challenge: string;
  purpose: 'registration' | 'authentication';
  userId?: number | null;
}): Promise<StoredChallenge> {
  await purgeExpiredChallenges();
  const token = newToken();
  const expiresAt = new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS);
  await db.insert(webauthnChallenges).values({
    token,
    challenge: opts.challenge,
    purpose: opts.purpose,
    userId: opts.userId ?? null,
    expiresAt
  });
  return { token, challenge: opts.challenge, expiresAt };
}

export async function consumeChallenge(
  token: string,
  purpose: 'registration' | 'authentication'
): Promise<{ challenge: string; userId: number | null } | null> {
  if (!token) return null;
  // Atomic single-use consume: DELETE … RETURNING is the one operation, so two
  // concurrent verifies with the same token can never both walk away with a
  // valid challenge : exactly one request receives a row, the other gets none.
  // We DELETE on the bare token (mirrors prior "always remove if it exists,
  // even if expired" behaviour) and post-filter purpose / expiry in JS.
  const rows = await db
    .delete(webauthnChallenges)
    .where(eq(webauthnChallenges.token, token))
    .returning({
      challenge: webauthnChallenges.challenge,
      userId: webauthnChallenges.userId,
      purpose: webauthnChallenges.purpose,
      expiresAt: webauthnChallenges.expiresAt
    });
  const row = rows[0];
  if (!row) return null;
  if (row.purpose !== purpose) return null;
  if (row.expiresAt <= new Date()) return null;
  return { challenge: row.challenge, userId: row.userId ?? null };
}

export async function listPasskeys(userId: number): Promise<Passkey[]> {
  return db.select().from(passkeys).where(eq(passkeys.userId, userId));
}

export async function findPasskey(credentialId: string): Promise<Passkey | undefined> {
  const rows = await db.select().from(passkeys).where(eq(passkeys.id, credentialId)).limit(1);
  return rows[0];
}

export async function deletePasskey(userId: number, credentialId: string): Promise<boolean> {
  // The returned array's length tells us whether the row existed (bun:sqlite's
  // delete builder doesn't expose an affected-rows count).
  const deleted = await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, credentialId), eq(passkeys.userId, userId)))
    .returning({ id: passkeys.id });
  return deleted.length > 0;
}

export async function renamePasskey(
  userId: number,
  credentialId: string,
  name: string
): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const updated = await db
    .update(passkeys)
    .set({ name: trimmed.slice(0, 80) })
    .where(and(eq(passkeys.id, credentialId), eq(passkeys.userId, userId)))
    .returning({ id: passkeys.id });
  return updated.length > 0;
}

export async function buildRegistrationOptions(opts: {
  userId: number;
  email: string;
  displayName: string;
  rpID: string;
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = await listPasskeys(opts.userId);
  // The WebAuthn user handle should be a stable, opaque identifier : we use
  // the numeric user id encoded as bytes.
  const userIdBytes = new TextEncoder().encode(String(opts.userId));
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: opts.rpID,
    userID: userIdBytes,
    userName: opts.email,
    userDisplayName: opts.displayName,
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.id,
      transports: c.transports
    })),
    authenticatorSelection: {
      // The login flow is username-less and does not send `allowCredentials`,
      // so only discoverable (resident) credentials can be used to sign in.
      // Force the authenticator to create a discoverable credential, otherwise
      // some keys downgrade and the resulting credential is unusable.
      residentKey: 'required',
      requireResidentKey: true,
      userVerification: 'preferred'
    }
  });
}

export async function buildAuthenticationOptions(opts: {
  rpID: string;
}): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return generateAuthenticationOptions({
    rpID: opts.rpID,
    userVerification: 'preferred'
  });
}

export type RegistrationResult = { ok: true; passkey: Passkey } | { ok: false; error: string };

export async function finishRegistration(opts: {
  userId: number;
  response: RegistrationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
  name: string;
}): Promise<RegistrationResult> {
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: opts.response,
      expectedChallenge: opts.expectedChallenge,
      expectedOrigin: opts.expectedOrigin,
      expectedRPID: opts.expectedRPID,
      // Deliberate downgrade. We request `userVerification: 'preferred'` at
      // options-generation time but accept responses without UV here, so
      // hardware authenticators that don't surface a PIN/biometric (e.g.
      // basic security keys) can still be used. Passkeys with platform
      // biometrics will perform UV anyway. The trade-off: a stolen unlocked
      // device could authenticate without a re-prompt : which is the same
      // threat model as a stolen unlocked browser session, since we already
      // gate sensitive flows (account deletion, password change) behind
      // their own confirmation steps.
      requireUserVerification: false
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Verification failed' };
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, error: 'Registration could not be verified' };
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  const existing = await findPasskey(credential.id);
  if (existing) {
    return { ok: false, error: 'Cette clé est déjà enregistrée.' };
  }

  const trimmedName = opts.name.trim().slice(0, 80) || 'Passkey';

  const inserted = await db
    .insert(passkeys)
    .values({
      id: credential.id,
      userId: opts.userId,
      publicKey: bufferToBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: opts.response.response.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: trimmedName,
      createdAt: new Date(),
      lastUsedAt: null
    })
    .returning();

  return { ok: true, passkey: inserted[0] };
}

export type AuthenticationResult =
  | { ok: true; passkey: Passkey; userId: number }
  | { ok: false; error: string };

// Single error string returned for every failure mode in finishAuthentication
// (unknown credential, bad signature, unverified). Distinct messages would
// give an unauthenticated probe a content oracle for credential existence
// even when the timing decoy keeps wall-clock costs equal.
export const PASSKEY_AUTH_FAILED_MESSAGE = "Échec de l'authentification.";

export async function finishAuthentication(opts: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
}): Promise<AuthenticationResult> {
  const credential = await findPasskey(opts.response.id);
  if (!credential) {
    // Run a decoy ECDSA verify so the response timing of "no such credential"
    // matches "credential found, signature wrong". Use the same generic error
    // message as the verified-but-bad-signature branch below: returning a
    // distinct string here would re-open the enumeration oracle the timing
    // decoy is meant to close (response body would tell the attacker which
    // branch fired even when wall-clock times match).
    timingDecoyVerify();
    return { ok: false, error: PASSKEY_AUTH_FAILED_MESSAGE };
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: opts.response,
      expectedChallenge: opts.expectedChallenge,
      expectedOrigin: opts.expectedOrigin,
      expectedRPID: opts.expectedRPID,
      credential: {
        id: credential.id,
        publicKey: base64UrlToBuffer(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports
      },
      // Mirrors the registration choice : see finishRegistration above for
      // the full rationale.
      requireUserVerification: false
    });
  } catch {
    return { ok: false, error: PASSKEY_AUTH_FAILED_MESSAGE };
  }

  if (!verification.verified) {
    return { ok: false, error: PASSKEY_AUTH_FAILED_MESSAGE };
  }

  const updated = await db
    .update(passkeys)
    .set({
      counter: verification.authenticationInfo.newCounter,
      backedUp: verification.authenticationInfo.credentialBackedUp,
      lastUsedAt: new Date()
    })
    .where(eq(passkeys.id, credential.id))
    .returning();

  return { ok: true, passkey: updated[0], userId: credential.userId };
}

export function publicPasskey(p: Passkey) {
  return {
    id: p.id,
    name: p.name,
    deviceType: p.deviceType,
    backedUp: p.backedUp,
    createdAt: p.createdAt.getTime(),
    lastUsedAt: p.lastUsedAt ? p.lastUsedAt.getTime() : null
  };
}
