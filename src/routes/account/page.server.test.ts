import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { hashPassword, SESSION_COOKIE, validateSession, createSession } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { load, actions } from './+page.server';

beforeEach(() => {
  resetTestDb();
});

async function seed() {
  const passwordHash = await hashPassword('current-password-12');
  const u = testDb
    .insert(users)
    .values({
      email: 'p@example.com',
      passwordHash,
      displayName: 'Parent',
      createdAt: new Date()
    })
    .returning()
    .all()[0];
  return u;
}

describe('account load', () => {
  it('redirects unauthenticated users to /login', async () => {
    const r = await captureFlow(() =>
      load(makeRouteEvent({ user: null }) as unknown as Parameters<typeof load>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('returns empty payload for authenticated users', async () => {
    const u = await seed();
    const out = await load(
      makeRouteEvent({ user: safeUser(u) }) as unknown as Parameters<typeof load>[0]
    );
    expect(out).toEqual({});
  });
});

describe('account updateProfile', () => {
  it('fails when displayName is empty', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { displayName: '' }
    });
    const r = (await actions.updateProfile!(
      event as unknown as Parameters<NonNullable<typeof actions.updateProfile>>[0]
    )) as { status: number; data: { profileError: string } };
    expect(r.status).toBe(400);
  });

  it('updates the displayName on success', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { displayName: '  New Name  ' }
    });
    const r = (await actions.updateProfile!(
      event as unknown as Parameters<NonNullable<typeof actions.updateProfile>>[0]
    )) as { profileSuccess: string };
    expect(r.profileSuccess).toBeTruthy();
    const fresh = testDb.select().from(users).where(eq(users.id, u.id)).get();
    expect(fresh?.displayName).toBe('New Name');
  });
});

describe('account changePassword', () => {
  it('fails on invalid schema', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { currentPassword: '', newPassword: 'short' }
    });
    const r = (await actions.changePassword!(
      event as unknown as Parameters<NonNullable<typeof actions.changePassword>>[0]
    )) as { status: number; data: { passwordError: string } };
    expect(r.status).toBe(400);
  });

  it('redirects to /login when user no longer exists', async () => {
    const u = await seed();
    testDb.delete(users).where(eq(users.id, u.id)).run();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: {
        currentPassword: 'current-password-12',
        newPassword: 'new-very-long-password-12+'
      }
    });
    const r = await captureFlow(() =>
      actions.changePassword!(
        event as unknown as Parameters<NonNullable<typeof actions.changePassword>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('fails when current password is wrong', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: {
        currentPassword: 'wrong-current',
        newPassword: 'new-very-long-password-12+'
      }
    });
    const r = (await actions.changePassword!(
      event as unknown as Parameters<NonNullable<typeof actions.changePassword>>[0]
    )) as { status: number; data: { passwordError: string } };
    expect(r.status).toBe(400);
    expect(r.data.passwordError).toMatch(/incorrect/i);
  });

  it('updates the password hash on success', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: {
        currentPassword: 'current-password-12',
        newPassword: 'new-very-long-password-12+'
      }
    });
    const r = (await actions.changePassword!(
      event as unknown as Parameters<NonNullable<typeof actions.changePassword>>[0]
    )) as { passwordSuccess: string };
    expect(r.passwordSuccess).toBeTruthy();
    const fresh = testDb.select().from(users).where(eq(users.id, u.id)).get();
    expect(fresh?.passwordHash).not.toBe(u.passwordHash);
  });
});

describe('account logoutEverywhere', () => {
  it('invalidates every session and clears the cookie + redirects', async () => {
    const u = await seed();
    const a = createSession(u.id);
    const b = createSession(u.id);
    const event = makeRouteEvent({ user: safeUser(u) });
    const r = await captureFlow(() =>
      actions.logoutEverywhere!(
        event as unknown as Parameters<NonNullable<typeof actions.logoutEverywhere>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
    expect(validateSession(a.id)).toBeNull();
    expect(validateSession(b.id)).toBeNull();
    expect(event.cookies.delete).toHaveBeenCalledWith(SESSION_COOKIE, { path: '/' });
  });
});
