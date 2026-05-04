import { randomBytes } from 'node:crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { and, eq, gt } from 'drizzle-orm';
import { db } from './db';
import { sessions, users, memberships, type Session, type User } from './db/schema';
import type { SafeUser } from '$lib/types';

export const SESSION_COOKIE = 'session';
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const SESSION_RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // 15 days

// Algorithm.Argon2id = 2 (avoid importing the const enum for verbatimModuleSyntax compat).
const ARGON_OPTS = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argonHash(plain, ARGON_OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argonVerify(hash, plain);
  } catch {
    return false;
  }
}

function newToken(): string {
  return randomBytes(32).toString('hex');
}

export function createSession(userId: number): Session {
  const now = Date.now();
  const id = newToken();
  const expiresAt = new Date(now + SESSION_DURATION_MS);
  db.insert(sessions).values({ id, userId, expiresAt }).run();
  return { id, userId, expiresAt };
}

export type ValidatedSession = {
  user: SafeUser;
  session: Session;
  renewed: boolean;
};

export function validateSession(token: string): ValidatedSession | null {
  if (!token) return null;
  const now = Date.now();

  const row = db
    .select({
      session: sessions,
      user: users
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date(now))))
    .get();

  if (!row) return null;

  let session = row.session;
  let renewed = false;
  if (session.expiresAt.getTime() - now < SESSION_RENEW_THRESHOLD_MS) {
    const newExpiry = new Date(now + SESSION_DURATION_MS);
    db.update(sessions).set({ expiresAt: newExpiry }).where(eq(sessions.id, token)).run();
    session = { ...session, expiresAt: newExpiry };
    renewed = true;
  }

  const safeUser: SafeUser = {
    id: row.user.id,
    email: row.user.email,
    displayName: row.user.displayName,
    createdAt: row.user.createdAt,
    tosAcceptedAt: row.user.tosAcceptedAt,
    privacyAcceptedAt: row.user.privacyAcceptedAt,
    ageConfirmedAt: row.user.ageConfirmedAt,
    lastLoginAt: row.user.lastLoginAt,
    lastExportAt: row.user.lastExportAt
  };

  return { user: safeUser, session, renewed };
}

export function invalidateSession(token: string): void {
  if (!token) return;
  db.delete(sessions).where(eq(sessions.id, token)).run();
}

export function invalidateAllUserSessions(userId: number): void {
  db.delete(sessions).where(eq(sessions.userId, userId)).run();
}

export function listMembershipsForUser(userId: number) {
  return db.select().from(memberships).where(eq(memberships.userId, userId)).all();
}

export function findUserByEmail(email: string): User | undefined {
  return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
}

export { generateInviteCodeRaw, isValidInviteCodeFormat } from '$lib/utils/invites';
