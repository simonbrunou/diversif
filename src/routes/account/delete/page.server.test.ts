import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, copyCookies, makeRouteEvent, safeUser, seedUser } from '../../../test/route';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

import { hashPassword } from '#lib/server/auth.js';
import { resumeSession, startSession } from '#lib/server/session.js';
import { _clearAllRateLimits } from '#lib/server/rate-limit.js';
import { users } from '#lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { actions, load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
  _clearAllRateLimits();
});

async function seed() {
  return seedUser({
    email: 'p@example.com',
    passwordHash: await hashPassword('current-password-12')
  });
}

describe('account/delete load', () => {
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

  it('deletes the user, signs the device out and redirects to /account/deleted', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: {
        confirmEmail: 'p@example.com',
        currentPassword: 'current-password-12'
      }
    });
    await startSession(event, u.id);
    const copy = makeRouteEvent({ cookies: copyCookies(event.cookies) });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/account/deleted');
    expect(
      (await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0]
    ).toBeUndefined();
    expect(await resumeSession(copy)).toBeNull();
    // Same shared-device hygiene as POST /logout: the 303 clears site data.
    expect(event.setHeaders).toHaveBeenCalledWith({ 'Clear-Site-Data': '"cache", "storage"' });
  });
});
