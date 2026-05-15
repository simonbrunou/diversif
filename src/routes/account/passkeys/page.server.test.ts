import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';
import { makeRouteEvent, safeUser } from '../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

const auditSpy = vi.fn();
vi.mock('$lib/server/audit', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/audit')>('$lib/server/audit');
  return { ...actual, audit: (...args: Parameters<typeof actual.audit>) => auditSpy(...args) };
});

import { hashPassword } from '$lib/server/auth';
import { passkeys, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
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

async function seedKey(userId: number, id = 'p1', name = 'Old') {
  await testDb.insert(passkeys).values({
    id,
    userId,
    publicKey: 'a',
    counter: 0,
    transports: [],
    deviceType: 'singleDevice',
    backedUp: false,
    name,
    createdAt: new Date(),
    lastUsedAt: null
  });
}

describe('account/passkeys rename', () => {
  it('fails with empty name', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'p1', name: '   ' }
    });
    const r = (await actions.rename!(
      event as unknown as Parameters<NonNullable<typeof actions.rename>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('fails 404 for unknown id', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'missing', name: 'New' }
    });
    const r = (await actions.rename!(
      event as unknown as Parameters<NonNullable<typeof actions.rename>>[0]
    )) as { status: number };
    expect(r.status).toBe(404);
  });

  it('updates the name on success', async () => {
    const u = await seed();
    await seedKey(u.id);
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'p1', name: 'New Name' }
    });
    const r = (await actions.rename!(
      event as unknown as Parameters<NonNullable<typeof actions.rename>>[0]
    )) as { passkeySuccessKey: string };
    expect(r.passkeySuccessKey).toBeTruthy();
    const fresh = (await testDb.select().from(passkeys).where(eq(passkeys.id, 'p1')).limit(1))[0];
    expect(fresh?.name).toBe('New Name');
    expect(auditSpy).toHaveBeenCalledWith({
      type: 'account.passkey_renamed',
      userId: u.id,
      passkeyId: 'p1'
    });
  });
});

describe('account/passkeys delete', () => {
  it('fails with no id', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: '' }
    });
    const r = (await actions.delete!(
      event as unknown as Parameters<NonNullable<typeof actions.delete>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('fails 404 for unknown id', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'missing' }
    });
    const r = (await actions.delete!(
      event as unknown as Parameters<NonNullable<typeof actions.delete>>[0]
    )) as { status: number };
    expect(r.status).toBe(404);
  });

  it('removes the row on success', async () => {
    const u = await seed();
    await seedKey(u.id);
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'p1' }
    });
    const r = (await actions.delete!(
      event as unknown as Parameters<NonNullable<typeof actions.delete>>[0]
    )) as { passkeySuccessKey: string };
    expect(r.passkeySuccessKey).toBeTruthy();
    const fresh = (await testDb.select().from(passkeys).where(eq(passkeys.id, 'p1')).limit(1))[0];
    expect(fresh).toBeUndefined();
    expect(auditSpy).toHaveBeenCalledWith({
      type: 'account.passkey_deleted',
      userId: u.id,
      passkeyId: 'p1'
    });
  });
});
