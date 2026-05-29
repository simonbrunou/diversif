import { randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import { db } from './db';
import { sessions, users, memberships, type Session, type User } from './db/schema';
import type { SafeUser } from '$lib/types';
import type { Cookies } from '@sveltejs/kit';

export const SESSION_COOKIE = 'session';
export const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const SESSION_RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // 15 days

// Bun.password ships argon2id natively. memoryCost/timeCost mirror the
// previous @node-rs/argon2 tuning so the cost profile is unchanged and
// existing $argon2id$ hashes from before the migration verify-roundtrip
// (the format is standard, not implementation-specific).
const ARGON_OPTS = {
  algorithm: 'argon2id',
  memoryCost: 19_456,
  timeCost: 2
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, ARGON_OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    // Bun.password.verify takes (password, hash) — OPPOSITE of
    // @node-rs/argon2's (hash, password). Flipped intentionally.
    return await Bun.password.verify(plain, hash);
  } catch {
    return false;
  }
}

// Decoy hash. Built lazily so importing the module is cheap (skipping argon
// during the import keeps the test suite fast), and warmed at module load in
// non-test runs so the FIRST production "no such user" attempt isn't ~2x
// slower than the steady state -- which would itself be a timing oracle.
// A single hash is reused for the lifetime of the process.
let decoyHashPromise: Promise<string> | null = null;
function getDecoyHash(): Promise<string> {
  if (!decoyHashPromise) {
    decoyHashPromise = hashPassword(`argon-decoy-${randomBytes(16).toString('hex')}`);
  }
  return decoyHashPromise;
}
/* v8 ignore next 3 : module-load warming, skipped in tests by design */
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  void getDecoyHash();
}

/**
 * Verify a password against a hash, or against a decoy hash if no real hash
 * is available. The decoy path makes the wall-clock time of "user does not
 * exist" indistinguishable from "user exists, password wrong" -- defeating
 * the timing oracle that would otherwise let an unauthenticated visitor probe
 * which emails are registered.
 */
export async function verifyPasswordOrDecoy(
  hash: string | null | undefined,
  plain: string
): Promise<boolean> {
  if (hash == null) {
    await verifyPassword(await getDecoyHash(), plain);
    return false;
  }
  return verifyPassword(hash, plain);
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
    db.transaction((tx) => {
      tx.update(sessions).set({ expiresAt: newExpiry }).where(eq(sessions.id, token)).run();
      tx.update(users)
        .set({ lastLoginAt: new Date(now) })
        .where(eq(users.id, row.user.id))
        .run();
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

/**
 * Set the session cookie with the canonical options used across login, signup,
 * and password-change flows. Centralises the 6-property options object so a
 * single place controls path, httpOnly, sameSite, secure and maxAge.
 */
export function setSessionCookie(cookies: Cookies, sessionId: string): void {
  cookies.set(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SESSION_DURATION_MS / 1000)
  });
}
