import { randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
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

export function originFromEnv(fallback: string): string {
  return process.env.ORIGIN ?? fallback;
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

export function purgeExpiredChallenges(now: Date = new Date()): void {
  db.delete(webauthnChallenges).where(lt(webauthnChallenges.expiresAt, now)).run();
}

export function createChallenge(opts: {
  challenge: string;
  purpose: 'registration' | 'authentication';
  userId?: number | null;
}): StoredChallenge {
  purgeExpiredChallenges();
  const token = newToken();
  const expiresAt = new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS);
  db.insert(webauthnChallenges)
    .values({
      token,
      challenge: opts.challenge,
      purpose: opts.purpose,
      userId: opts.userId ?? null,
      expiresAt
    })
    .run();
  return { token, challenge: opts.challenge, expiresAt };
}

export function consumeChallenge(
  token: string,
  purpose: 'registration' | 'authentication'
): { challenge: string; userId: number | null } | null {
  if (!token) return null;
  const row = db
    .select()
    .from(webauthnChallenges)
    .where(
      and(
        eq(webauthnChallenges.token, token),
        eq(webauthnChallenges.purpose, purpose),
        gt(webauthnChallenges.expiresAt, new Date())
      )
    )
    .get();
  // Always remove the token if it exists, even if expired.
  db.delete(webauthnChallenges).where(eq(webauthnChallenges.token, token)).run();
  if (!row) return null;
  return { challenge: row.challenge, userId: row.userId ?? null };
}

export function listPasskeys(userId: number): Passkey[] {
  return db.select().from(passkeys).where(eq(passkeys.userId, userId)).all();
}

export function findPasskey(credentialId: string): Passkey | undefined {
  return db.select().from(passkeys).where(eq(passkeys.id, credentialId)).get();
}

export function deletePasskey(userId: number, credentialId: string): boolean {
  const row = db
    .select()
    .from(passkeys)
    .where(and(eq(passkeys.id, credentialId), eq(passkeys.userId, userId)))
    .get();
  if (!row) return false;
  db.delete(passkeys)
    .where(and(eq(passkeys.id, credentialId), eq(passkeys.userId, userId)))
    .run();
  return true;
}

export function renamePasskey(userId: number, credentialId: string, name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const row = db
    .select()
    .from(passkeys)
    .where(and(eq(passkeys.id, credentialId), eq(passkeys.userId, userId)))
    .get();
  if (!row) return false;
  db.update(passkeys)
    .set({ name: trimmed.slice(0, 80) })
    .where(and(eq(passkeys.id, credentialId), eq(passkeys.userId, userId)))
    .run();
  return true;
}

export async function buildRegistrationOptions(opts: {
  userId: number;
  email: string;
  displayName: string;
  rpID: string;
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = listPasskeys(opts.userId);
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
      residentKey: 'preferred',
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
      requireUserVerification: false
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Verification failed' };
  }

  if (!verification.verified || !verification.registrationInfo) {
    return { ok: false, error: 'Registration could not be verified' };
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  const existing = findPasskey(credential.id);
  if (existing) {
    return { ok: false, error: 'Cette clé est déjà enregistrée.' };
  }

  const trimmedName = opts.name.trim().slice(0, 80) || 'Passkey';
  const transportsJson = JSON.stringify(opts.response.response.transports ?? []);

  const row = db
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
    .returning()
    .get();

  return { ok: true, passkey: row };
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
  const credential = findPasskey(opts.response.id);
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
      requireUserVerification: false
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Verification failed' };
  }

  if (!verification.verified) {
    return { ok: false, error: 'Authentication could not be verified' };
  }

  const updated = db
    .update(passkeys)
    .set({
      counter: verification.authenticationInfo.newCounter,
      backedUp: verification.authenticationInfo.credentialBackedUp,
      lastUsedAt: new Date()
    })
    .where(eq(passkeys.id, credential.id))
    .returning()
    .get();

  return { ok: true, passkey: updated, userId: credential.userId };
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
