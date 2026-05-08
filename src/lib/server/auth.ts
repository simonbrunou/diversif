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

export async function createSession(userId: number): Promise<Session> {
  const now = Date.now();
  const id = newToken();
  const expiresAt = new Date(now + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return { id, userId, expiresAt };
}

export type ValidatedSession = {
  user: SafeUser;
  session: Session;
  renewed: boolean;
};

export async function validateSession(token: string): Promise<ValidatedSession | null> {
  if (!token) return null;
  const now = Date.now();

  const rows = await db
    .select({
      session: sessions,
      user: users
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, token), gt(sessions.expiresAt, new Date(now))))
    .limit(1);
  const row = rows[0];

  if (!row) return null;

  let session = row.session;
  let renewed = false;
  if (session.expiresAt.getTime() - now < SESSION_RENEW_THRESHOLD_MS) {
    const newExpiry = new Date(now + SESSION_DURATION_MS);
    // Wrap both updates in a transaction so a crash between them can't leave
    // the session renewed without a corresponding lastLoginAt bump (or vice
    // versa). Bumping `last_login_at` keeps retention queries seeing recent
    // activity even when the user never explicitly re-logs in.
    await db.transaction(async (tx) => {
      await tx.update(sessions).set({ expiresAt: newExpiry }).where(eq(sessions.id, token));
      await tx
        .update(users)
        .set({ lastLoginAt: new Date(now) })
        .where(eq(users.id, row.user.id));
    });
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

export async function invalidateSession(token: string): Promise<void> {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, token));
}

export async function invalidateAllUserSessions(userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function listMembershipsForUser(userId: number) {
  return db.select().from(memberships).where(eq(memberships.userId, userId));
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return rows[0];
}

export { generateInviteCodeRaw, isValidInviteCodeFormat } from '$lib/utils/invites';
