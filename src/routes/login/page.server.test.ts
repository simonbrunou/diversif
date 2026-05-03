import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { hashPassword, SESSION_COOKIE } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { load, actions } from './+page.server';

beforeEach(() => {
  resetTestDb();
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
    return testDb
      .insert(users)
      .values({
        email: 'parent@example.com',
        passwordHash,
        displayName: 'Parent',
        createdAt: new Date()
      })
      .returning()
      .all()[0];
  }

  it('fails 400 on invalid email shape', async () => {
    const event = makeRouteEvent({
      formData: { email: 'not-an-email', password: 'whatever' }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(result.status).toBe(400);
    expect(result.data.error).toMatch(/email|invalide/i);
  });

  it('fails 400 on empty password', async () => {
    const event = makeRouteEvent({
      formData: { email: 'a@example.com', password: '' }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(result.status).toBe(400);
  });

  it('fails 400 when user does not exist', async () => {
    const event = makeRouteEvent({
      formData: { email: 'nobody@example.com', password: 'anything' }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string; email: string } };
    expect(result.status).toBe(400);
    expect(result.data.error).toMatch(/incorrect/i);
    expect(result.data.email).toBe('nobody@example.com');
  });

  it('fails 400 when password is wrong', async () => {
    await seedTestUser();
    const event = makeRouteEvent({
      formData: { email: 'parent@example.com', password: 'wrong-password' }
    });
    const result = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(result.status).toBe(400);
    expect(result.data.error).toMatch(/incorrect/i);
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
});
