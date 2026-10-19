import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { db } from './db';
import { sessions, users } from './db/schema';
import type { SafeUser } from '#lib/types.js';

/**
 * The session lifecycle: the only module that knows the session cookie, its
 * options, and how its token maps to a stored row. Routes and the server hook
 * start, resume, restart or end a session through the five functions below
 * and never see a token.
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

// Wipes the HTTP cache and site storage: CacheStorage (the SW 'pages' runtime
// cache may hold authenticated HTML from an older SW build), IndexedDB
// (offline queue), localStorage and the SW registration, so the next person
// on a shared device can't read the previous user's data. Safari doesn't
// honour the header reliably, so the logout forms also purge client-side
// before submitting (purgeBeforeSubmit in #lib/offline/purge). The account
// deletion form can't: purging before the POST would wipe the offline queue
// of an account a refused attempt (wrong email or password, rate limit)
// leaves in place. Its enhanced redirect is a client-side navigation
// instead, so the root layout purges when it sees the user turn anonymous;
// a no-JS deletion gets the header only.
const CLEAR_SITE_DATA = '"cache", "storage"';

type CookieEvent = Pick<RequestEvent, 'cookies'>;
type SignOutEvent = Pick<RequestEvent, 'cookies' | 'setHeaders'>;

/** The stored row id for a cookie token. */
function sessionIdFor(token: string): string {
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

function clearCookie(cookies: Cookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

async function issueSession(cookies: Cookies, userId: number): Promise<void> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db.insert(sessions).values({ id: sessionIdFor(token), userId, expiresAt });
  setCookie(cookies, token);
}

async function revokeDeviceSession(cookies: Cookies): Promise<void> {
  const token = cookies.get(SESSION_COOKIE);
  if (token) await db.delete(sessions).where(eq(sessions.id, sessionIdFor(token)));
}

async function revokeAllSessions(userId: number): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/** Delete the cookie and send Clear-Site-Data; revokes nothing itself. */
function clearDevice(event: SignOutEvent): void {
  clearCookie(event.cookies);
  // setHeaders applies to the response the caller produces next (the thrown
  // 303, or the redirect result of an enhanced form action). SvelteKit throws
  // if the header is set twice, so callers must not set it themselves.
  event.setHeaders({ 'Clear-Site-Data': CLEAR_SITE_DATA });
}

/**
 * Sign this device in as `userId` for 30 days (login, passkey login) and
 * record the sign-in in `last_login_at`. A session the device already held is
 * revoked, not just orphaned by the new cookie, so a copy of the old cookie
 * stops working too.
 */
export async function startSession(event: CookieEvent, userId: number): Promise<void> {
  await revokeDeviceSession(event.cookies);
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  await issueSession(event.cookies, userId);
}

/**
 * The user this request's session cookie belongs to, or null. Runs once per
 * request in the server hook. A session used within its last 15 days is
 * pushed back to 30 days from now (same token, new cookie maxAge,
 * `last_login_at` bumped). An unknown or expired cookie is deleted, and an
 * expired row with it.
 */
export async function resumeSession(event: CookieEvent): Promise<SafeUser | null> {
  const token = event.cookies.get(SESSION_COOKIE);
  if (!token) return null;
  const now = Date.now();
  const id = sessionIdFor(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);
  if (!row || row.session.expiresAt.getTime() <= now) {
    // An unknown cookie has no row, so it costs no write.
    if (row) await db.delete(sessions).where(eq(sessions.id, id));
    clearCookie(event.cookies);
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
 * device back in on a new one (password change). Not a sign-in: leaves
 * `last_login_at` alone. Sends no Clear-Site-Data: the user stays signed in
 * and keeps their offline queue.
 */
export async function restartSession(event: CookieEvent, userId: number): Promise<void> {
  await revokeAllSessions(userId);
  await issueSession(event.cookies, userId);
}

/**
 * Sign this device out (logout, account deletion): revoke its session, delete
 * the cookie and send Clear-Site-Data. Safe on a device without a session.
 * The caller throws the redirect.
 */
export async function endSession(event: SignOutEvent): Promise<void> {
  await revokeDeviceSession(event.cookies);
  clearDevice(event);
}

/** Like endSession, but revokes every session of `userId` (« Se déconnecter partout »). */
export async function endAllSessions(event: SignOutEvent, userId: number): Promise<void> {
  await revokeAllSessions(userId);
  clearDevice(event);
}
