import { randomBytes } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from '@simplewebauthn/server';
import type {
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON
} from '@simplewebauthn/server';
import { db } from './db';
import { passkeys, webauthnChallenges, type Passkey } from './db/schema';

export const RP_NAME = 'Diversif';
export const PASSKEY_CHALLENGE_COOKIE = 'wa_challenge';
export const PASSKEY_CHALLENGE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function rpIdFromOrigin(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return 'localhost';
  }
}

/**
 * Browsers send the page's origin in WebAuthn responses without a trailing
 * slash, while operators sometimes write `ORIGIN=https://example.com/` in env
 * files. simplewebauthn does an exact string compare, so any trailing slash
 * (or surrounding whitespace) breaks verification.
 */
export function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function originFromEnv(fallback: string): string {
  return normalizeOrigin(process.env.ORIGIN ?? fallback);
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

function parseTransports(value: string): AuthenticatorTransportFuture[] {
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is AuthenticatorTransportFuture => typeof t === 'string');
    }
  } catch {
    // ignore malformed values
  }
  return [];
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
  // valid challenge — exactly one request receives a row, the other gets none.
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
  const result = await db
    .delete(passkeys)
    .where(and(eq(passkeys.id, credentialId), eq(passkeys.userId, userId)));
  /* v8 ignore next — node-postgres always populates rowCount for DELETE */
  return (result.rowCount ?? 0) > 0;
}

export async function renamePasskey(
  userId: number,
  credentialId: string,
  name: string
): Promise<boolean> {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const result = await db
    .update(passkeys)
    .set({ name: trimmed.slice(0, 80) })
    .where(and(eq(passkeys.id, credentialId), eq(passkeys.userId, userId)));
  /* v8 ignore next — node-postgres always populates rowCount for UPDATE */
  return (result.rowCount ?? 0) > 0;
}

export async function buildRegistrationOptions(opts: {
  userId: number;
  email: string;
  displayName: string;
  rpID: string;
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = await listPasskeys(opts.userId);
  // The WebAuthn user handle should be a stable, opaque identifier — we use
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
      transports: parseTransports(c.transports)
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
      // device could authenticate without a re-prompt — which is the same
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
  const transportsJson = JSON.stringify(opts.response.response.transports ?? []);

  const inserted = await db
    .insert(passkeys)
    .values({
      id: credential.id,
      userId: opts.userId,
      publicKey: bufferToBase64Url(credential.publicKey),
      counter: credential.counter,
      transports: transportsJson,
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

export async function finishAuthentication(opts: {
  response: AuthenticationResponseJSON;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRPID: string;
}): Promise<AuthenticationResult> {
  const credential = await findPasskey(opts.response.id);
  if (!credential) {
    return { ok: false, error: 'Clé inconnue.' };
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
        transports: parseTransports(credential.transports)
      },
      // Mirrors the registration choice — see finishRegistration above for
      // the full rationale.
      requireUserVerification: false
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Verification failed' };
  }

  if (!verification.verified) {
    return { ok: false, error: 'Authentication could not be verified' };
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
