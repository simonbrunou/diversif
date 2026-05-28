import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

const auditSpy = mock();
mock.module('$lib/server/audit', async () => {
  const actual = await ((await import('$lib/server/audit')) as typeof import('$lib/server/audit'));
  return { ...actual, audit: (...args: Parameters<typeof actual.audit>) => auditSpy(...args) };
});

import { hashPassword, SESSION_COOKIE, validateSession, createSession } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { actions, load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
  auditSpy.mockClear();
});

async function seed() {
  const passwordHash = await hashPassword('current-password-12');
  const u = (
    await testDb
      .insert(users)
      .values({
        email: 'p@example.com',
        passwordHash,
        displayName: 'Parent',
        createdAt: new Date()
      })
      .returning()
  )[0];
  return u;
}

describe('account/sessions load', () => {
  it('redirects unauthenticated users to /login', async () => {
    const r = await captureFlow(() =>
      load(makeRouteEvent({ user: null }) as unknown as Parameters<typeof load>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('returns empty data for authenticated users', async () => {
    const u = await seed();
    const out = await load(
      makeRouteEvent({ user: safeUser(u) }) as unknown as Parameters<typeof load>[0]
    );
    expect(out).toEqual({});
  });
});

describe('account/sessions logoutEverywhere', () => {
  it('invalidates every session, clears the cookie, redirects', async () => {
    const u = await seed();
    const a = await createSession(u.id);
    const b = await createSession(u.id);
    const event = makeRouteEvent({ user: safeUser(u) });
    const r = await captureFlow(() =>
      actions.logoutEverywhere!(
        event as unknown as Parameters<NonNullable<typeof actions.logoutEverywhere>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
    expect(await validateSession(a.id)).toBeNull();
    expect(await validateSession(b.id)).toBeNull();
    expect(event.cookies.delete).toHaveBeenCalledWith(SESSION_COOKIE, { path: '/' });
    expect(auditSpy).toHaveBeenCalledWith({ type: 'account.sessions_revoked', userId: u.id });
  });
});
