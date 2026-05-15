import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

const auditSpy = vi.fn();
vi.mock('$lib/server/audit', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/audit')>('$lib/server/audit');
  return { ...actual, audit: (...args: Parameters<typeof actual.audit>) => auditSpy(...args) };
});

import { hashPassword, SESSION_COOKIE, validateSession, createSession } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { actions } from './+page.server';

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
