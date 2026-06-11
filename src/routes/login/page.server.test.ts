import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { hashPassword, SESSION_COOKIE } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { _clearAllRateLimits, peekRateLimit, resetRateLimit } from '$lib/server/rate-limit';
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

  // Mirrors LOGIN_EMAIL_LIMIT in +page.server.ts — only `name` and the key
  // matter for peeking at the shared bucket; limit drives `remaining`.
  const EMAIL_LIMIT = { name: 'login-email', limit: 20, windowMs: 60 * 60 * 1000 };

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

  it('fails 400 when the email exceeds 254 characters', async () => {
    // Syntactically valid address that only the .max(254) bound rejects —
    // the e-mail is the per-account rate-limit key, so its length (and the
    // bucket-key space an attacker can mint) must be capped.
    const longEmail = `${'a'.repeat(250)}@example.com`;
    const event = makeRouteEvent({
      formData: { email: longEmail, password: 'whatever' }
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

  it('returns 429 when the per-account (email) limit is exceeded, even across IPs', async () => {
    // Simulate a distributed attack: keep the per-IP bucket below its limit
    // by resetting it between attempts, so only the email bucket can trip.
    for (let i = 0; i < 20; i++) {
      resetRateLimit('login', '127.0.0.1');
      const event = makeRouteEvent({
        // Mixed case on purpose: the bucket must key on the normalized email.
        formData: { email: 'Target@Example.com', password: 'whatever' }
      });
      await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      );
    }
    resetRateLimit('login', '127.0.0.1');
    const event = makeRouteEvent({
      formData: { email: 'target@example.com', password: 'whatever' }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: Record<string, unknown> };
    expect(result.status).toBe(429);
    // Byte-identical to the per-IP throttle body: the response must not
    // reveal which bucket tripped, nor whether the account exists.
    expect(result.data).toEqual({ email: '', errorKey: 'errorsAuthRateLimited' });
  });

  it('does not consume the per-email bucket on successful logins', async () => {
    await seedTestUser();
    for (let i = 0; i < 3; i++) {
      resetRateLimit('login', '127.0.0.1');
      const event = makeRouteEvent({
        formData: { email: 'parent@example.com', password: 'correct-password' }
      });
      const result = await captureFlow(() =>
        actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
      );
      expect(result.kind).toBe('redirect');
    }
    // Three successes, zero hits recorded: a user logging in 20+ times/hour
    // (or an attacker replaying the form) can never lock the account this way.
    expect(peekRateLimit(EMAIL_LIMIT, 'parent@example.com').remaining).toBe(EMAIL_LIMIT.limit);
  });

  it('consumes the per-email bucket only on failed attempts', async () => {
    await seedTestUser();
    const fail1 = makeRouteEvent({
      formData: { email: 'parent@example.com', password: 'wrong-password' }
    });
    await actions.default!(fail1 as unknown as Parameters<NonNullable<typeof actions.default>>[0]);
    expect(peekRateLimit(EMAIL_LIMIT, 'parent@example.com').remaining).toBe(EMAIL_LIMIT.limit - 1);

    // A subsequent success neither consumes nor resets the failure count.
    const ok = makeRouteEvent({
      formData: { email: 'parent@example.com', password: 'correct-password' }
    });
    const result = await captureFlow(() =>
      actions.default!(ok as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(result.kind).toBe('redirect');
    expect(peekRateLimit(EMAIL_LIMIT, 'parent@example.com').remaining).toBe(EMAIL_LIMIT.limit - 1);
  });

  it('does not trip the email bucket for attempts on other addresses', async () => {
    await seedTestUser();
    for (let i = 0; i < 20; i++) {
      resetRateLimit('login', '127.0.0.1');
      const event = makeRouteEvent({
        formData: { email: 'someone-else@example.com', password: 'whatever' }
      });
      await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      );
    }
    resetRateLimit('login', '127.0.0.1');
    const event = makeRouteEvent({
      formData: { email: 'parent@example.com', password: 'correct-password' }
    });
    const result = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(result.kind).toBe('redirect');
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
