import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { createSession, SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { POST } from './+server';

beforeEach(() => {
  resetTestDb();
});

describe('logout POST', () => {
  it('invalidates the session and clears the cookie', async () => {
    const u = testDb
      .insert(users)
      .values({
        email: 'a@example.com',
        passwordHash: 'placeholder-hash',
        displayName: 'A',
        createdAt: new Date()
      })
      .returning()
      .all()[0];
    const session = createSession(u.id);

    const event = makeRouteEvent({
      user: safeUser(u),
      sessionId: session.id
    });
    const result = await captureFlow(() => POST(event as unknown as Parameters<typeof POST>[0]));
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect') expect(result.location).toBe('/login');
    expect(validateSession(session.id)).toBeNull();
    expect(event.cookies.delete).toHaveBeenCalledWith(SESSION_COOKIE, { path: '/' });
  });

  it('still clears the cookie when no session is present', async () => {
    const event = makeRouteEvent({ user: null, sessionId: null });
    const result = await captureFlow(() => POST(event as unknown as Parameters<typeof POST>[0]));
    expect(result.kind).toBe('redirect');
    expect(event.cookies.delete).toHaveBeenCalled();
  });
});
