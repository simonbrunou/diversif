import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { hashPassword, SESSION_COOKIE } from '$lib/server/auth';
import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { actions } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
  _clearAllRateLimits();
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

describe('account/delete deleteAccount', () => {
  it('fails when the typed email does not match', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { confirmEmail: 'wrong@example.com' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { deleteErrorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.deleteErrorKey).toBe('errorsAccountDeleteEmailMismatch');
    expect((await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0]).toBeDefined();
  });

  it('matches the typed email case-insensitively against the stored email', async () => {
    const passwordHash = await hashPassword('current-password-12');
    const u = (
      await testDb
        .insert(users)
        .values({
          email: 'Mixed@Example.COM',
          passwordHash,
          displayName: 'Parent',
          createdAt: new Date()
        })
        .returning()
    )[0];
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: {
        confirmEmail: '  mixed@example.com  ',
        currentPassword: 'current-password-12'
      }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/account/deleted');
    expect(
      (await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0]
    ).toBeUndefined();
  });

  it('fails when the confirmEmail field is missing entirely', async () => {
    const u = await seed();
    const event = makeRouteEvent({ user: safeUser(u), formData: {} });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { deleteErrorKey: string } };
    expect(r.status).toBe(400);
    expect((await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0]).toBeDefined();
  });

  it('fails when currentPassword is missing', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { confirmEmail: 'p@example.com' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { deleteErrorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.deleteErrorKey).toBe('errorsAccountPasswordIncorrect');
    expect((await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0]).toBeDefined();
  });

  it('redirects to /login when user row is gone (race)', async () => {
    const u = await seed();
    await testDb.delete(users).where(eq(users.id, u.id));
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { confirmEmail: 'p@example.com', currentPassword: 'current-password-12' }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('fails when currentPassword is wrong', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { confirmEmail: 'p@example.com', currentPassword: 'wrong-current' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { deleteErrorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.deleteErrorKey).toBe('errorsAccountPasswordIncorrect');
    expect((await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0]).toBeDefined();
  });

  it('deletes the user, clears the cookie and redirects to /account/deleted', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: {
        confirmEmail: 'p@example.com',
        currentPassword: 'current-password-12'
      }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/account/deleted');
    expect(
      (await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0]
    ).toBeUndefined();
    expect(event.cookies.delete).toHaveBeenCalledWith(SESSION_COOKIE, { path: '/' });
  });

  it('rate-limits brute-force attempts on the currentPassword field', async () => {
    const u = await seed();
    for (let i = 0; i < 5; i++) {
      const event = makeRouteEvent({
        user: safeUser(u),
        formData: { confirmEmail: 'p@example.com', currentPassword: 'wrong' }
      });
      await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      );
    }
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { confirmEmail: 'p@example.com', currentPassword: 'wrong' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { deleteErrorKey: string } };
    expect(r.status).toBe(429);
    expect(r.data.deleteErrorKey).toBe('errorsAuthRateLimited');
    expect((await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0]).toBeDefined();
  });
});
