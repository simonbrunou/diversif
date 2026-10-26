import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, copyCookies, makeRouteEvent, safeUser, seedUser } from '../../../test/route';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

import { hashPassword } from '#lib/server/auth.js';
import { resumeSession, startSession } from '#lib/server/session.js';
import { _clearAllRateLimits } from '#lib/server/rate-limit.js';
import { users } from '#lib/server/db/schema.js';
import { eq, sql } from 'drizzle-orm';
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
  it('redirects unauthenticated POSTs to /login', async () => {
    const event = makeRouteEvent({
      user: null,
      formData: { confirmEmail: 'p@example.com', currentPassword: 'current-password-12' }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
    expect(event.setHeaders).not.toHaveBeenCalled();
  });

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
    // A refused attempt keeps the account, so the browser keeps its storage.
    expect(event.setHeaders).not.toHaveBeenCalled();
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
    expect(event.setHeaders).not.toHaveBeenCalled();
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
    expect(event.setHeaders).not.toHaveBeenCalled();
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
    expect(event.setHeaders).not.toHaveBeenCalled();
  });

  it('keeps the typed email after a wrong password', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { confirmEmail: 'p@example.com', currentPassword: 'wrong-current' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { deleteErrorKey: string; confirmEmail: string } };
    expect(r.status).toBe(400);
    // Echoed so a no-JS re-render can refill the field (#471).
    expect(r.data).toEqual({
      deleteErrorKey: 'errorsAccountPasswordIncorrect',
      confirmEmail: 'p@example.com'
    });
  });

  it('keeps a mismatched email exactly as typed, so it can be corrected', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { confirmEmail: ' Autre@Example.com ', currentPassword: 'current-password-12' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { deleteErrorKey: string; confirmEmail: string } };
    expect(r.status).toBe(400);
    expect(r.data).toEqual({
      deleteErrorKey: 'errorsAccountDeleteEmailMismatch',
      confirmEmail: ' Autre@Example.com '
    });
  });

  it('keeps the typed email and the 429 once fresh-auth is rate limited', async () => {
    const u = await seed();
    const submit = (currentPassword: string) =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          formData: { confirmEmail: 'p@example.com', currentPassword }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      );
    for (let i = 0; i < 5; i++) await submit('wrong-current');

    const r = (await submit('current-password-12')) as {
      status: number;
      data: { deleteErrorKey: string; confirmEmail: string };
    };
    expect(r.status).toBe(429);
    expect(r.data).toEqual({
      deleteErrorKey: 'errorsAuthRateLimited',
      confirmEmail: 'p@example.com'
    });
  });

  it('never echoes the password in a refusal payload', async () => {
    const u = await seed();
    const submit = (confirmEmail: string, currentPassword: string) =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(u),
          formData: { confirmEmail, currentPassword }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      ) as Promise<{ status: number; data: Record<string, string> }>;

    // Every refusal path: a mismatch with the right password, five wrong
    // passwords, then the right one once the budget of five is spent.
    const refusals = [await submit('autre@example.com', 'current-password-12')];
    for (let i = 0; i < 5; i++) refusals.push(await submit('p@example.com', 'wrong-current'));
    refusals.push(await submit('p@example.com', 'current-password-12'));
    expect(refusals.map((r) => r.status)).toEqual([400, 400, 400, 400, 400, 400, 429]);
    for (const r of refusals) {
      const payload = JSON.stringify(r.data);
      expect(payload).not.toContain('current-password-12');
      expect(payload).not.toContain('wrong-current');
    }
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
    // Same shared-device hygiene as POST /logout: the response (action JSON
    // when the form is enhanced, the 303 without JS) clears site data.
    expect(event.setHeaders).toHaveBeenCalledWith({ 'Clear-Site-Data': '"cache", "storage"' });
  });

  it('keeps the session and the browser storage when the deletion itself fails', async () => {
    // The sign-out must come after deleteUserAccount: SvelteKit merges
    // setHeaders onto every response, the 500 included, so signing out
    // earlier would wipe the offline queue and the session of an account
    // that survived the failed (transactional) deletion.
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { confirmEmail: 'p@example.com', currentPassword: 'current-password-12' }
    });
    await startSession(event, u.id);
    const copy = makeRouteEvent({ cookies: copyCookies(event.cookies) });
    try {
      testDb.run(
        sql`CREATE TRIGGER tmp_abort_user_delete BEFORE DELETE ON users
            BEGIN SELECT RAISE(ABORT, 'simulated user-delete failure'); END`
      );
      await expect(
        captureFlow(() =>
          actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
        )
      ).rejects.toThrow(/simulated user-delete failure/);
    } finally {
      testDb.run(sql`DROP TRIGGER IF EXISTS tmp_abort_user_delete`);
    }
    expect((await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0]).toBeDefined();
    expect(await resumeSession(copy)).not.toBeNull();
    expect(event.setHeaders).not.toHaveBeenCalled();
    expect(event.cookies.delete).not.toHaveBeenCalled();
  });
});
