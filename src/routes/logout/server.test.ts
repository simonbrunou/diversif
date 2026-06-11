import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { createSession, SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { POST } from './+server';

beforeEach(async () => {
  await resetTestDb();
});

describe('logout POST', () => {
  it('invalidates the session and clears the cookie', async () => {
    const u = (
      await testDb
        .insert(users)
        .values({
          email: 'a@example.com',
          passwordHash: 'placeholder-hash',
          displayName: 'A',
          createdAt: new Date()
        })
        .returning()
    )[0];
    const { token, session } = await createSession(u.id);

    // The handler invalidates via the raw cookie token (sessions are stored
    // hashed at rest; locals.sessionId holds the digest, which can't be
    // replayed through the token-hashing delete path).
    const event = makeRouteEvent({
      user: safeUser(u),
      sessionId: session.id,
      cookies: { [SESSION_COOKIE]: token }
    });
    const result = await captureFlow(() => POST(event as unknown as Parameters<typeof POST>[0]));
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect') expect(result.location).toBe('/login');
    expect(await validateSession(token)).toBeNull();
    expect(event.cookies.delete).toHaveBeenCalledWith(SESSION_COOKIE, { path: '/' });
    // The 303 must carry Clear-Site-Data so Chromium/Firefox wipe the SW
    // 'pages' cache + IndexedDB even when JS (the client-side purge) is off.
    expect(event.setHeaders).toHaveBeenCalledWith({ 'Clear-Site-Data': '"cache", "storage"' });
  });

  it('still clears the cookie when no session is present', async () => {
    const event = makeRouteEvent({ user: null, sessionId: null });
    const result = await captureFlow(() => POST(event as unknown as Parameters<typeof POST>[0]));
    expect(result.kind).toBe('redirect');
    expect(event.cookies.delete).toHaveBeenCalled();
    expect(event.setHeaders).toHaveBeenCalledWith({ 'Clear-Site-Data': '"cache", "storage"' });
  });
});
