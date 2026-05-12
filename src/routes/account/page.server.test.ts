import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser, seedUser } from '../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

const auditSpy = vi.fn();
vi.mock('$lib/server/audit', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/audit')>('$lib/server/audit');
  return { ...actual, audit: (...args: Parameters<typeof actual.audit>) => auditSpy(...args) };
});

import { hashPassword, SESSION_COOKIE, validateSession, createSession } from '$lib/server/auth';
import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { passkeys, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { load, actions } from './+page.server';
import { seedChild, seedMembership } from '../../test/route';

beforeEach(async () => {
  await resetTestDb();
  _clearAllRateLimits();
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
    await testDb.insert(passkeys).values({
      id: 'p1',
      userId: u.id,
      publicKey: 'a',
      counter: 0,
      transports: [],
      deviceType: 'singleDevice',
      backedUp: false,
      name: 'Phone',
      createdAt: new Date(),
      lastUsedAt: null
    });
    const out = await load(
      makeRouteEvent({ user: safeUser(u) }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.passkeys.length).toBe(1);
    expect(out.passkeys[0].id).toBe('p1');
  });
});

describe('account load — bento data', () => {
  it('returns children, locale, theme alongside passkeys', async () => {
    const u = await seed();
    // Create a second user to act as coparent
    const coparent = await seedUser({ email: 'coparent@example.com', displayName: 'Coparent' });
    const child = await seedChild({ name: 'Léa', birthDate: '2024-06-01', createdBy: u.id });
    await seedMembership({ userId: u.id, childId: child.id, role: 'owner' });
    await seedMembership({ userId: coparent.id, childId: child.id, role: 'member' });

    const event = makeRouteEvent({ user: safeUser(u) });

    const out = await load(event as unknown as Parameters<typeof load>[0]);

    expect(Array.isArray(out.children)).toBe(true);
    expect(out.children.length).toBe(1);
    expect(out.children[0].name).toBe('Léa');
    expect(out.children[0].id).toBe(String(child.id));
    expect(typeof out.children[0].ageMonths).toBe('number');

    // Coparent appears
    expect(out.children[0].coparents.length).toBe(1);
    expect(out.children[0].coparents[0].id).toBe(String(coparent.id));
    expect(out.children[0].coparents[0].displayName).toBe('Coparent');
    expect(out.children[0].coparents[0].role).toBe('member');

    // locale defaults to 'fr'
    expect(out.locale).toBe('fr');

    // theme defaults to 'system' when no cookie
    expect(out.theme).toBe('system');

    // passkeys still returned
    expect(Array.isArray(out.passkeys)).toBe(true);
  });

  it('picks up locale from locals', async () => {
    const u = await seed();
    const event = makeRouteEvent({ user: safeUser(u), locale: 'en' });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.locale).toBe('en');
  });

  it('reads a valid theme cookie', async () => {
    const u = await seed();
    const event = makeRouteEvent({ user: safeUser(u) });
    event.cookies.set('theme', 'dark', {});
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.theme).toBe('dark');
  });

  it('falls back theme to system for an invalid cookie value', async () => {
    const u = await seed();
    const event = makeRouteEvent({ user: safeUser(u) });
    event.cookies.set('theme', 'purple', {});
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.theme).toBe('system');
  });
});

describe('account renamePasskey / deletePasskey', () => {
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
    await seedKey(u.id);
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'p1', name: 'New Name' }
    });
    const r = (await actions.renamePasskey!(
      event as unknown as Parameters<NonNullable<typeof actions.renamePasskey>>[0]
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
    await seedKey(u.id);
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { id: 'p1' }
    });
    const r = (await actions.deletePasskey!(
      event as unknown as Parameters<NonNullable<typeof actions.deletePasskey>>[0]
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
    const fresh = (await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0];
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
    await testDb.delete(users).where(eq(users.id, u.id));
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
    const fresh = (await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0];
    expect(fresh?.passwordHash).not.toBe(u.passwordHash);
    expect(auditSpy).toHaveBeenCalledWith({ type: 'account.password_changed', userId: u.id });
  });

  it('drops every existing session and issues a new one for this tab', async () => {
    const u = await seed();
    const a = await createSession(u.id);
    const b = await createSession(u.id);
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: {
        currentPassword: 'current-password-12',
        newPassword: 'new-very-long-password-12+'
      }
    });
    await actions.changePassword!(
      event as unknown as Parameters<NonNullable<typeof actions.changePassword>>[0]
    );

    // The two pre-existing sessions are both gone.
    expect(await validateSession(a.id)).toBeNull();
    expect(await validateSession(b.id)).toBeNull();

    // A fresh session was created for this tab and the cookie was set.
    const setCalls = (event.cookies.set as ReturnType<typeof vi.fn>).mock.calls;
    expect(setCalls.length).toBeGreaterThanOrEqual(1);
    const [name, value, opts] = setCalls[setCalls.length - 1];
    expect(name).toBe(SESSION_COOKIE);
    expect(typeof value).toBe('string');
    expect((opts as { httpOnly?: boolean }).httpOnly).toBe(true);
    expect(await validateSession(value as string)).not.toBeNull();
  });

  it('rate-limits brute-force attempts on the currentPassword field', async () => {
    const u = await seed();
    // 5 wrong-password attempts are allowed, the 6th gets 429.
    for (let i = 0; i < 5; i++) {
      const event = makeRouteEvent({
        user: safeUser(u),
        formData: { currentPassword: 'wrong', newPassword: 'new-very-long-password-12+' }
      });
      await actions.changePassword!(
        event as unknown as Parameters<NonNullable<typeof actions.changePassword>>[0]
      );
    }
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { currentPassword: 'wrong', newPassword: 'new-very-long-password-12+' }
    });
    const r = (await actions.changePassword!(
      event as unknown as Parameters<NonNullable<typeof actions.changePassword>>[0]
    )) as { status: number; data: { passwordErrorKey: string } };
    expect(r.status).toBe(429);
    expect(r.data.passwordErrorKey).toBe('errorsAuthRateLimited');
  });
});

describe('account logoutEverywhere', () => {
  it('invalidates every session and clears the cookie + redirects', async () => {
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
    expect((await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0]).toBeDefined();
  });

  it('matches the typed email case-insensitively against the stored email', async () => {
    // Stored emails are lowercased by signup, but if a row ever bypasses
    // signup and lands with mixed case, the user must still be able to
    // confirm deletion. Lowercase both sides at compare time.
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
      actions.deleteAccount!(
        event as unknown as Parameters<NonNullable<typeof actions.deleteAccount>>[0]
      )
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
    const r = (await actions.deleteAccount!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteAccount>>[0]
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
    const r = (await actions.deleteAccount!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteAccount>>[0]
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
      actions.deleteAccount!(
        event as unknown as Parameters<NonNullable<typeof actions.deleteAccount>>[0]
      )
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
    const r = (await actions.deleteAccount!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteAccount>>[0]
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
      actions.deleteAccount!(
        event as unknown as Parameters<NonNullable<typeof actions.deleteAccount>>[0]
      )
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
    // 5 wrong-password attempts allowed, the 6th gets 429.
    for (let i = 0; i < 5; i++) {
      const event = makeRouteEvent({
        user: safeUser(u),
        formData: { confirmEmail: 'p@example.com', currentPassword: 'wrong' }
      });
      await actions.deleteAccount!(
        event as unknown as Parameters<NonNullable<typeof actions.deleteAccount>>[0]
      );
    }
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { confirmEmail: 'p@example.com', currentPassword: 'wrong' }
    });
    const r = (await actions.deleteAccount!(
      event as unknown as Parameters<NonNullable<typeof actions.deleteAccount>>[0]
    )) as { status: number; data: { deleteErrorKey: string } };
    expect(r.status).toBe(429);
    expect(r.data.deleteErrorKey).toBe('errorsAuthRateLimited');
    expect((await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0]).toBeDefined();
  });
});
