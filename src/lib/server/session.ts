import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { db } from './db';
import { sessions, users } from './db/schema';
import type { SafeUser } from '#lib/types.js';

/**
 * The session lifecycle: the only module that knows the session cookie, its
 * options, and how its token maps to a stored row. Routes start, resume,
 * restart or end a session through the five functions below and never see a
 * token.
 *
 * Sessions are stored hashed at rest: the cookie carries the raw 256-bit
 * token, the DB row id is sha256(token) hex. Anyone holding the SQLite file
 * (or a backup of it) sees only digests — useless as bearer tokens without
 * the preimage. Plain sha256 (no salt, no argon) is deliberate: the token has
 * 256 bits of entropy, so rainbow tables and brute force are both moot, and
 * an unsalted digest keeps validation a single indexed equality lookup.
 */

const SESSION_COOKIE = 'session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // 15 days

// Wipes CacheStorage (the SW 'pages' runtime cache holds authenticated HTML),
// IndexedDB (offline queue) and the SW registration, so the next person on a
// shared device can't read the previous user's data. Safari doesn't honour
// the header reliably, so every sign-out form also purges client-side before
// submitting (purgeBeforeSubmit in #lib/offline/purge).
const CLEAR_SITE_DATA = '"cache", "storage"';

type CookieEvent = Pick<RequestEvent, 'cookies'>;
type SignOutEvent = Pick<RequestEvent, 'cookies' | 'setHeaders'>;

function newToken(): string {
  return randomBytes(32).toString('hex');
}

function digest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function setCookie(cookies: Cookies, token: string): void {
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: Math.floor(SESSION_DURATION_MS / 1000)
  });
}

async function revokeThisDevice(cookies: Cookies): Promise<void> {
  const token = cookies.get(SESSION_COOKIE);
  if (token) await db.delete(sessions).where(eq(sessions.id, digest(token)));
}

function signOutDevice(event: SignOutEvent): void {
  event.cookies.delete(SESSION_COOKIE, { path: '/' });
  // setHeaders applies to the 303 the caller throws next: SvelteKit merges
  // event-accumulated headers onto the redirect response. It throws if the
  // header is set twice, so callers must not set Clear-Site-Data themselves.
  event.setHeaders({ 'Clear-Site-Data': CLEAR_SITE_DATA });
}

/**
 * Sign this device in as `userId` for 30 days (login, passkey login). A
 * session the device already held is revoked, not just orphaned by the new
 * cookie, so a copy of the old cookie stops working too.
 */
export async function startSession(event: CookieEvent, userId: number): Promise<void> {
  await revokeThisDevice(event.cookies);
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id: digest(token), userId, expiresAt });
  setCookie(event.cookies, token);
}

/**
 * The user this request's session cookie belongs to, or null. Runs once per
 * request in the server hook. A session used within its last 15 days is
 * extended by another 30 (same token, new cookie maxAge, `last_login_at`
 * bumped); an unknown or expired cookie is deleted along with its row.
 */
export async function resumeSession(event: CookieEvent): Promise<SafeUser | null> {
  const token = event.cookies.get(SESSION_COOKIE);
  if (!token) return null;
  const now = Date.now();
  const id = digest(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);
  if (!row || row.session.expiresAt.getTime() <= now) {
    // Only an expired row needs deleting: an unknown cookie costs no write.
    if (row) await db.delete(sessions).where(eq(sessions.id, id));
    event.cookies.delete(SESSION_COOKIE, { path: '/' });
    return null;
  }

  if (row.session.expiresAt.getTime() - now < SESSION_RENEW_THRESHOLD_MS) {
    // Wrap both updates in a transaction so a crash between them can't leave
    // the session renewed without a corresponding lastLoginAt bump (or vice
    // versa). Bumping `last_login_at` keeps retention queries seeing recent
    // activity even when the user never explicitly re-logs in.
    db.transaction((tx) => {
      tx.update(sessions)
        .set({ expiresAt: new Date(now + SESSION_DURATION_MS) })
        .where(eq(sessions.id, id))
        .run();
      tx.update(users)
        .set({ lastLoginAt: new Date(now) })
        .where(eq(users.id, row.user.id))
        .run();
    });
    // Renewal only extends the cookie's maxAge, it never rotates the token.
    setCookie(event.cookies, token);
  }

  return {
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
}

/**
 * Revoke every session of `userId` (including a stolen cookie) and sign this
 * device back in on a new one (password change). Sends no Clear-Site-Data:
 * the user stays signed in and keeps their offline queue.
 */
export async function restartSession(event: CookieEvent, userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await startSession(event, userId);
}

/**
 * Sign this device out (logout, account deletion): revoke its session, delete
 * the cookie and send Clear-Site-Data. Safe on a device without a session.
 * The caller throws the redirect.
 */
export async function endSession(event: SignOutEvent): Promise<void> {
  await revokeThisDevice(event.cookies);
  signOutDevice(event);
}

/** Like endSession, but revokes every session of `userId` (« Se déconnecter partout »). */
export async function endAllSessions(event: SignOutEvent, userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
  signOutDevice(event);
}
