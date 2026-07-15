import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { makeRouteEvent, safeUser, seedUser } from '../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

const auditSpy = mock();
import * as actualAudit from '$lib/server/audit';
mock.module('$lib/server/audit', () => ({
  ...actualAudit,
  audit: (...args: Parameters<typeof actualAudit.audit>) => auditSpy(...args)
}));

import { hashPassword } from '$lib/server/auth';
import { passkeys, users } from '$lib/server/db/schema';
import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { eq } from 'drizzle-orm';
import { actions, load } from './+page.server';
import { captureFlow } from '../../../test/route';

beforeEach(async () => {
  await resetTestDb();
  // The delete action shares the fresh-auth bucket (keyed on user.id), which
  // would otherwise accumulate hits across tests and trip spuriously.
  _clearAllRateLimits();
  auditSpy.mockClear();
});

async function seed() {
  return seedUser({
    email: 'p@example.com',
    passwordHash: await hashPassword('current-password-12')
  });
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

describe('account/passkeys load', () => {
  it('redirects unauthenticated users to /login', async () => {
    const r = await captureFlow(() =>
      load(makeRouteEvent({ user: null }) as unknown as Parameters<typeof load>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('returns the passkey list for authenticated users', async () => {
    const u = await seed();
    await seedKey(u.id);
    const out = await load(
      makeRouteEvent({ user: safeUser(u) }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.passkeys.length).toBe(1);
    expect(out.passkeys[0].id).toBe('p1');
  });
});

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
      formData: { id: '', currentPassword: 'current-password-12' }
    });
    const r = (await actions.delete!(
      event as unknown as Parameters<NonNullable<typeof actions.delete>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('fails with no currentPassword (fresh-auth is mandatory)', async () => {
    const u = await seed();
    await seedKey(u.id);
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'p1' }
    });
    const r = (await actions.delete!(
      event as unknown as Parameters<NonNullable<typeof actions.delete>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
    const fresh = (await testDb.select().from(passkeys).where(eq(passkeys.id, 'p1')).limit(1))[0];
    expect(fresh).toBeDefined();
  });

  it('fails 400 with a wrong password and keeps the key', async () => {
    const u = await seed();
    await seedKey(u.id);
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'p1', currentPassword: 'not-the-password' }
    });
    const r = (await actions.delete!(
      event as unknown as Parameters<NonNullable<typeof actions.delete>>[0]
    )) as { status: number; data: { passkeyErrorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.passkeyErrorKey).toBe('errorsAccountPasswordIncorrect');
    const fresh = (await testDb.select().from(passkeys).where(eq(passkeys.id, 'p1')).limit(1))[0];
    expect(fresh).toBeDefined();
    expect(auditSpy).not.toHaveBeenCalled();
  });

  it('rate-limits repeated wrong-password attempts', async () => {
    const u = await seed();
    await seedKey(u.id);
    for (let i = 0; i < 5; i++) {
      await actions.delete!(
        makeRouteEvent({
          user: safeUser(u),
          formData: { id: 'p1', currentPassword: 'not-the-password' }
        }) as unknown as Parameters<NonNullable<typeof actions.delete>>[0]
      );
    }
    const r = (await actions.delete!(
      makeRouteEvent({
        user: safeUser(u),
        formData: { id: 'p1', currentPassword: 'current-password-12' }
      }) as unknown as Parameters<NonNullable<typeof actions.delete>>[0]
    )) as { status: number; data: { passkeyErrorKey: string } };
    expect(r.status).toBe(429);
    expect(r.data.passkeyErrorKey).toBe('errorsAuthRateLimited');
  });

  it('redirects to /login when the user row has vanished', async () => {
    const u = await seed();
    await seedKey(u.id);
    await testDb.delete(users).where(eq(users.id, u.id));
    const r = await captureFlow(() =>
      actions.delete!(
        makeRouteEvent({
          user: safeUser(u),
          formData: { id: 'p1', currentPassword: 'current-password-12' }
        }) as unknown as Parameters<NonNullable<typeof actions.delete>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('fails 404 for unknown id', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'missing', currentPassword: 'current-password-12' }
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
      formData: { id: 'p1', currentPassword: 'current-password-12' }
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
