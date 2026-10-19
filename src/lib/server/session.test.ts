import { afterEach, beforeEach, describe, expect, it, mock, setSystemTime } from 'bun:test';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../test/db';
import { copyCookies, makeRouteEvent, seedUser } from '../../test/route';
import { sessions, users } from './db/schema';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

const { startSession, resumeSession, restartSession, endSession, endAllSessions } =
  await import('./session');

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await resetTestDb();
});

afterEach(() => {
  setSystemTime();
});

describe('startSession / resumeSession', () => {
  it('signs the device in: the next request resumes as the same user', async () => {
    const user = await seedUser();
    const device = makeRouteEvent();
    await startSession(device, user.id);

    const resumed = await resumeSession(device);
    expect(resumed?.id).toBe(user.id);
    // An allowlist, so a future sensitive column can't leak into locals.user.
    expect(Object.keys(resumed!).sort()).toEqual([
      'ageConfirmedAt',
      'createdAt',
      'displayName',
      'email',
      'id',
      'lastExportAt',
      'lastLoginAt',
      'privacyAcceptedAt',
      'tosAcceptedAt'
    ]);
  });

  it("revokes the device's previous session when signing in again", async () => {
    const first = await seedUser({ email: 'a@example.com' });
    const second = await seedUser({ email: 'b@example.com' });
    const device = makeRouteEvent();
    await startSession(device, first.id);
    const previous = makeRouteEvent({ cookies: copyCookies(device.cookies) });
    expect((await resumeSession(previous))?.id).toBe(first.id);

    await startSession(device, second.id);
    expect((await resumeSession(device))?.id).toBe(second.id);
    expect(await resumeSession(previous)).toBeNull();
  });

  it('issues a 30-day httpOnly, SameSite=Lax cookie named "session" on /', async () => {
    const user = await seedUser();
    const device = makeRouteEvent();
    await startSession(device, user.id);

    expect(device.cookies.set).toHaveBeenCalledTimes(1);
    const [name, , opts] = device.cookies.set.mock.calls[0];
    expect(name).toBe('session');
    expect(opts).toEqual({
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 30 * 24 * 60 * 60
    });
  });

  it('marks the cookie Secure in production', async () => {
    const user = await seedUser();
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const device = makeRouteEvent();
      await startSession(device, user.id);
      expect(device.cookies.set.mock.calls[0][2]).toMatchObject({ secure: true });
    } finally {
      process.env.NODE_ENV = orig;
    }
  });

  it('stores only the sha256 digest of the cookie token, never the token itself', async () => {
    // A leaked SQLite file or backup must be useless for session hijacking.
    // The digest format is pinned independently of the module: changing it
    // would sign out every production user.
    const user = await seedUser();
    const device = makeRouteEvent();
    await startSession(device, user.id);

    const token = device.cookies.set.mock.calls[0][1];
    const [row] = await testDb.select().from(sessions).where(eq(sessions.userId, user.id));
    expect(row.id).toBe(createHash('sha256').update(token).digest('hex'));
    expect(row.id).not.toBe(token);
  });

  it('does not authenticate the stored digest replayed as a cookie', async () => {
    const user = await seedUser();
    await startSession(makeRouteEvent(), user.id);
    const [row] = await testDb.select().from(sessions).where(eq(sessions.userId, user.id));

    expect(await resumeSession(makeRouteEvent({ cookies: { session: row.id } }))).toBeNull();
  });
});

describe('resumeSession renewal', () => {
  it('leaves a session with more than 15 days left untouched', async () => {
    const user = await seedUser();
    const device = makeRouteEvent();
    await startSession(device, user.id);
    device.cookies.set.mockClear();

    setSystemTime(Date.now() + 14 * DAY_MS);
    expect((await resumeSession(device))?.id).toBe(user.id);
    expect(device.cookies.set).not.toHaveBeenCalled();
  });

  it('extends a session used within its last 15 days by another 30 days', async () => {
    const user = await seedUser();
    const device = makeRouteEvent();
    await startSession(device, user.id);
    const [, token] = device.cookies.set.mock.calls[0];
    device.cookies.set.mockClear();
    const start = Date.now();

    setSystemTime(start + 16 * DAY_MS);
    expect((await resumeSession(device))?.id).toBe(user.id);
    // Renewal re-sends the same raw token (it never rotates) with a fresh
    // 30-day maxAge; sending the stored digest would sign the user out.
    expect(device.cookies.set).toHaveBeenCalledTimes(1);
    const [name, value, opts] = device.cookies.set.mock.calls[0];
    expect(name).toBe('session');
    expect(value).toBe(token);
    expect(opts).toMatchObject({ httpOnly: true, path: '/', maxAge: 30 * 24 * 60 * 60 });

    // Day 40: past the original 30-day expiry, inside the renewed one.
    setSystemTime(start + 40 * DAY_MS);
    expect((await resumeSession(device))?.id).toBe(user.id);
  });

  it('records the renewal as activity in last_login_at', async () => {
    const user = await seedUser();
    const device = makeRouteEvent();
    await startSession(device, user.id);
    const start = Date.now();

    setSystemTime(start + 16 * DAY_MS);
    await resumeSession(device);
    const [row] = await testDb.select().from(users).where(eq(users.id, user.id));
    expect(row.lastLoginAt!.getTime()).toBeGreaterThan(start + 15 * DAY_MS);
  });
});

const CLEAR_SITE_DATA = { 'Clear-Site-Data': '"cache", "storage"' };

describe('endSession', () => {
  it('revokes the session server-side: a copy of the cookie no longer authenticates', async () => {
    const user = await seedUser();
    const device = makeRouteEvent();
    await startSession(device, user.id);
    const stolen = makeRouteEvent({ cookies: copyCookies(device.cookies) });
    expect((await resumeSession(stolen))?.id).toBe(user.id);

    await endSession(device);
    expect(await resumeSession(stolen)).toBeNull();
  });

  it('deletes the cookie and tells the browser to clear cached pages and storage', async () => {
    const user = await seedUser();
    const device = makeRouteEvent();
    await startSession(device, user.id);

    await endSession(device);
    expect(device.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
    expect(device.setHeaders).toHaveBeenCalledWith(CLEAR_SITE_DATA);
  });

  it("leaves the user's other devices signed in", async () => {
    const user = await seedUser();
    const phone = makeRouteEvent();
    const laptop = makeRouteEvent();
    await startSession(phone, user.id);
    await startSession(laptop, user.id);

    await endSession(phone);
    expect((await resumeSession(laptop))?.id).toBe(user.id);
  });

  it('still clears the cookie and site data on a device without a session', async () => {
    const device = makeRouteEvent();
    await endSession(device);
    expect(device.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
    expect(device.setHeaders).toHaveBeenCalledWith(CLEAR_SITE_DATA);
  });
});

describe('endAllSessions', () => {
  it("revokes every device of the user and nobody else's", async () => {
    const user = await seedUser({ email: 'a@example.com' });
    const other = await seedUser({ email: 'b@example.com' });
    const phone = makeRouteEvent();
    const laptop = makeRouteEvent();
    const otherDevice = makeRouteEvent();
    await startSession(phone, user.id);
    await startSession(laptop, user.id);
    await startSession(otherDevice, other.id);
    const stolen = makeRouteEvent({ cookies: copyCookies(phone.cookies) });
    expect((await resumeSession(stolen))?.id).toBe(user.id);

    await endAllSessions(phone, user.id);
    expect(await resumeSession(laptop)).toBeNull();
    expect(await resumeSession(stolen)).toBeNull();
    expect((await resumeSession(otherDevice))?.id).toBe(other.id);
  });

  it('signs this device out like endSession', async () => {
    const user = await seedUser();
    const device = makeRouteEvent();
    await startSession(device, user.id);

    await endAllSessions(device, user.id);
    expect(device.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
    expect(device.setHeaders).toHaveBeenCalledWith(CLEAR_SITE_DATA);
  });
});

describe('restartSession', () => {
  it('revokes every existing session, including a copy of this device cookie', async () => {
    const user = await seedUser();
    const device = makeRouteEvent();
    const laptop = makeRouteEvent();
    await startSession(device, user.id);
    await startSession(laptop, user.id);
    const stolen = makeRouteEvent({ cookies: copyCookies(device.cookies) });
    expect((await resumeSession(stolen))?.id).toBe(user.id);

    await restartSession(device, user.id);
    expect(await resumeSession(laptop)).toBeNull();
    expect(await resumeSession(stolen)).toBeNull();
  });

  it('keeps this device signed in on a new session without clearing site data', async () => {
    // The user stays signed in, so wiping storage would only drop their
    // offline queue and unregister the service worker.
    const user = await seedUser();
    const device = makeRouteEvent();
    await startSession(device, user.id);

    await restartSession(device, user.id);
    expect((await resumeSession(device))?.id).toBe(user.id);
    expect(device.setHeaders).not.toHaveBeenCalled();
  });
});

describe('resumeSession on a signed-out device', () => {
  it('returns null and leaves cookies alone when there is no session cookie', async () => {
    const device = makeRouteEvent();
    expect(await resumeSession(device)).toBeNull();
    expect(device.cookies.set).not.toHaveBeenCalled();
    expect(device.cookies.delete).not.toHaveBeenCalled();
  });

  it('clears an unknown session cookie', async () => {
    const device = makeRouteEvent({ cookies: { session: 'garbage-token' } });
    expect(await resumeSession(device)).toBeNull();
    expect(device.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
  });

  it('expires a session left unused for 30 days, and clears its cookie and row', async () => {
    const user = await seedUser();
    const device = makeRouteEvent();
    await startSession(device, user.id);

    setSystemTime(Date.now() + 31 * DAY_MS);
    expect(await resumeSession(device)).toBeNull();
    expect(device.cookies.delete).toHaveBeenCalledWith('session', { path: '/' });
    expect(await testDb.select().from(sessions)).toHaveLength(0);
  });
});
