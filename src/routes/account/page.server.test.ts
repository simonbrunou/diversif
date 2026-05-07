import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { hashPassword, SESSION_COOKIE, validateSession, createSession } from '$lib/server/auth';
import { passkeys, users } from '$lib/server/db/schema';
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

  it('returns the passkey list for authenticated users', async () => {
    const u = await seed();
    testDb
      .insert(passkeys)
      .values({
        id: 'p1',
        userId: u.id,
        publicKey: 'a',
        counter: 0,
        transports: '[]',
        deviceType: 'singleDevice',
        backedUp: false,
        name: 'Phone',
        createdAt: new Date(),
        lastUsedAt: null
      })
      .run();
    const out = await load(
      makeRouteEvent({ user: safeUser(u) }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.passkeys.length).toBe(1);
    expect(out.passkeys[0].id).toBe('p1');
  });
});

describe('account renamePasskey / deletePasskey', () => {
  function seedKey(userId: number, id = 'p1', name = 'Old') {
    testDb
      .insert(passkeys)
      .values({
        id,
        userId,
        publicKey: 'a',
        counter: 0,
        transports: '[]',
        deviceType: 'singleDevice',
        backedUp: false,
        name,
        createdAt: new Date(),
        lastUsedAt: null
      })
      .run();
  }

  it('renamePasskey fails with empty name', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'p1', name: '   ' }
    });
    const r = (await actions.renamePasskey!(
      event as unknown as Parameters<NonNullable<typeof actions.renamePasskey>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('renamePasskey fails 404 for unknown id', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'missing', name: 'New' }
    });
    const r = (await actions.renamePasskey!(
      event as unknown as Parameters<NonNullable<typeof actions.renamePasskey>>[0]
    )) as { status: number };
    expect(r.status).toBe(404);
  });

  it('renamePasskey updates the name on success', async () => {
    const u = await seed();
    seedKey(u.id);
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'p1', name: 'New Name' }
    });
    const r = (await actions.renamePasskey!(
      event as unknown as Parameters<NonNullable<typeof actions.renamePasskey>>[0]
    )) as { passkeySuccessKey: string };
    expect(r.passkeySuccessKey).toBeTruthy();
    const fresh = testDb.select().from(passkeys).where(eq(passkeys.id, 'p1')).get();
    expect(fresh?.name).toBe('New Name');
  });

  it('deletePasskey fails with no id', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: '' }
    });
    const r = (await actions.deletePasskey!(
      event as unknown as Parameters<NonNullable<typeof actions.deletePasskey>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('deletePasskey fails 404 for unknown id', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'missing' }
    });
    const r = (await actions.deletePasskey!(
      event as unknown as Parameters<NonNullable<typeof actions.deletePasskey>>[0]
    )) as { status: number };
    expect(r.status).toBe(404);
  });

  it('deletePasskey removes the row on success', async () => {
    const u = await seed();
    seedKey(u.id);
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'p1' }
    });
    const r = (await actions.deletePasskey!(
      event as unknown as Parameters<NonNullable<typeof actions.deletePasskey>>[0]
    )) as { passkeySuccessKey: string };
    expect(r.passkeySuccessKey).toBeTruthy();
    const fresh = testDb.select().from(passkeys).where(eq(passkeys.id, 'p1')).get();
    expect(fresh).toBeUndefined();
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
    )) as { profileSuccessKey: string };
    expect(r.profileSuccessKey).toBeTruthy();
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
    )) as { status: number; data: { passwordErrorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.passwordErrorKey).toBe('errorsAuthBadInput');
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
    )) as { status: number; data: { passwordErrorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.passwordErrorKey).toBe('errorsAccountPasswordIncorrect');
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
    )) as { passwordSuccessKey: string };
    expect(r.passwordSuccessKey).toBeTruthy();
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

describe('account deleteAccount', () => {
  it('fails when the typed email does not match', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { confirmEmail: 'wrong@example.com' }
    });
    const r = (await actions.deleteAccount!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteAccount>>[0]
    )) as { status: number; data: { deleteErrorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.deleteErrorKey).toBe('errorsAccountDeleteEmailMismatch');
    expect(testDb.select().from(users).where(eq(users.id, u.id)).get()).toBeDefined();
  });

  it('fails when the confirmEmail field is missing entirely', async () => {
    const u = await seed();
    const event = makeRouteEvent({ user: safeUser(u), formData: {} });
    const r = (await actions.deleteAccount!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteAccount>>[0]
    )) as { status: number; data: { deleteErrorKey: string } };
    expect(r.status).toBe(400);
    expect(testDb.select().from(users).where(eq(users.id, u.id)).get()).toBeDefined();
  });

  it('deletes the user, clears the cookie and redirects to /account/deleted', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { confirmEmail: 'p@example.com' }
    });
    const r = await captureFlow(() =>
      actions.deleteAccount!(
        event as unknown as Parameters<NonNullable<typeof actions.deleteAccount>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/account/deleted');
    expect(testDb.select().from(users).where(eq(users.id, u.id)).get()).toBeUndefined();
    expect(event.cookies.delete).toHaveBeenCalledWith(SESSION_COOKIE, { path: '/' });
  });
});
