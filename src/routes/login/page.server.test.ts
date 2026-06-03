import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { hashPassword, SESSION_COOKIE } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { load, actions } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
  _clearAllRateLimits();
});

describe('login load', () => {
  it('passes through for guests', async () => {
    const out = await load(makeRouteEvent({ user: null }) as unknown as Parameters<typeof load>[0]);
    expect(out).toEqual({});
  });

  it('redirects authenticated users away', async () => {
    const u = {
      id: 1,
      email: 'a@example.com',
      displayName: 'A',
      createdAt: new Date()
    };
    const result = await captureFlow(() =>
      load(makeRouteEvent({ user: safeUser(u) }) as unknown as Parameters<typeof load>[0])
    );
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect') expect(result.location).toBe('/');
  });
});

describe('login default action', () => {
  async function seedTestUser() {
    const passwordHash = await hashPassword('correct-password');
    return (
      await testDb
        .insert(users)
        .values({
          email: 'parent@example.com',
          passwordHash,
          displayName: 'Parent',
          createdAt: new Date()
        })
        .returning()
    )[0];
  }

  it('fails 400 on invalid email shape', async () => {
    const event = makeRouteEvent({
      formData: { email: 'not-an-email', password: 'whatever' }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(result.status).toBe(400);
    expect(result.data.errorKey).toBe('errorsAuthBadInput');
  });

  it('fails 400 on empty password', async () => {
    const event = makeRouteEvent({
      formData: { email: 'a@example.com', password: '' }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(result.status).toBe(400);
    expect(result.data.errorKey).toBe('errorsAuthBadInput');
  });

  it('fails 400 when user does not exist', async () => {
    const event = makeRouteEvent({
      formData: { email: 'nobody@example.com', password: 'anything' }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string; email: string } };
    expect(result.status).toBe(400);
    expect(result.data.errorKey).toBe('errorsAuthInvalidCredentials');
    expect(result.data.email).toBe('nobody@example.com');
  });

  it('fails 400 when password is wrong', async () => {
    await seedTestUser();
    const event = makeRouteEvent({
      formData: { email: 'parent@example.com', password: 'wrong-password' }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(result.status).toBe(400);
    expect(result.data.errorKey).toBe('errorsAuthInvalidCredentials');
  });

  it('issues a session cookie and redirects on success', async () => {
    await seedTestUser();
    const event = makeRouteEvent({
      formData: { email: 'parent@example.com', password: 'correct-password' }
    });
    const result = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect') expect(result.location).toBe('/');
    expect(event.cookies.set).toHaveBeenCalled();
    const setArgs = event.cookies.set.mock.calls[0];
    expect(setArgs[0]).toBe(SESSION_COOKIE);
  });

  it('preserves the /en locale on successful redirect', async () => {
    await seedTestUser();
    const event = makeRouteEvent({
      locale: 'en',
      formData: { email: 'parent@example.com', password: 'correct-password' }
    });
    const result = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect') expect(result.location).toBe('/en');
  });

  it('returns 429 when the per-IP rate limit is exceeded', async () => {
    // Hit the bucket exactly `limit` times so the next call trips it.
    for (let i = 0; i < 10; i++) {
      const event = makeRouteEvent({
        formData: { email: 'noone@example.com', password: 'whatever' }
      });
      await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      );
    }
    const event = makeRouteEvent({
      formData: { email: 'noone@example.com', password: 'whatever' }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(result.status).toBe(429);
    expect(result.data.errorKey).toBe('errorsAuthRateLimited');
  });

  it('marks the cookie secure in production', async () => {
    await seedTestUser();
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const event = makeRouteEvent({
        formData: { email: 'parent@example.com', password: 'correct-password' }
      });
      await captureFlow(() =>
        actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
      );
      expect(event.cookies.set.mock.calls[0][2].secure).toBe(true);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });

  it('audits login_failed (without userId) and login_succeeded', async () => {
    const user = await seedTestUser();
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    // Read mock.calls BEFORE mockRestore() — restoring clears the recorded calls.
    let events: Array<Record<string, unknown>>;
    try {
      await actions.default!(
        makeRouteEvent({
          formData: { email: 'parent@example.com', password: 'wrong-password' }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      );
      await captureFlow(() =>
        actions.default!(
          makeRouteEvent({
            formData: { email: 'parent@example.com', password: 'correct-password' }
          }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
        )
      );
      events = logSpy.mock.calls
        .map((c) => c[0])
        .filter((line): line is string => typeof line === 'string' && line.startsWith('{'))
        .map((line) => JSON.parse(line));
    } finally {
      logSpy.mockRestore();
    }

    const failed = events.find((e) => e.type === 'auth.login_failed');
    const succeeded = events.find((e) => e.type === 'auth.login_succeeded');
    expect(failed).toMatchObject({ level: 'audit', method: 'password' });
    // Security invariant: a failed attempt must NOT record which account it
    // targeted, or the audit log becomes an account-enumeration oracle.
    expect(failed).not.toHaveProperty('userId');
    expect(succeeded).toMatchObject({ level: 'audit', method: 'password', userId: user.id });
  });
});
