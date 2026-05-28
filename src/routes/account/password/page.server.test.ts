import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

const auditSpy = mock();
import * as actualAudit from '$lib/server/audit';
mock.module('$lib/server/audit', () => ({
  ...actualAudit,
  audit: (...args: Parameters<typeof actualAudit.audit>) => auditSpy(...args)
}));

import { hashPassword, SESSION_COOKIE, validateSession, createSession } from '$lib/server/auth';
import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { actions, load } from './+page.server';

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

describe('account/password load', () => {
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

describe('account/password changePassword', () => {
  it('fails on invalid schema', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { currentPassword: '', newPassword: 'short' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
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
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
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
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
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
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
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
    await actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0]);

    expect(await validateSession(a.id)).toBeNull();
    expect(await validateSession(b.id)).toBeNull();

    const setCalls = (event.cookies.set as ReturnType<typeof mock>).mock.calls;
    expect(setCalls.length).toBeGreaterThanOrEqual(1);
    const [name, value, opts] = setCalls[setCalls.length - 1];
    expect(name).toBe(SESSION_COOKIE);
    expect(typeof value).toBe('string');
    expect((opts as { httpOnly?: boolean }).httpOnly).toBe(true);
    expect(await validateSession(value as string)).not.toBeNull();
  });

  it('rate-limits brute-force attempts on the currentPassword field', async () => {
    const u = await seed();
    for (let i = 0; i < 5; i++) {
      const event = makeRouteEvent({
        user: safeUser(u),
        formData: { currentPassword: 'wrong', newPassword: 'new-very-long-password-12+' }
      });
      await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      );
    }
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { currentPassword: 'wrong', newPassword: 'new-very-long-password-12+' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { passwordErrorKey: string } };
    expect(r.status).toBe(429);
    expect(r.data.passwordErrorKey).toBe('errorsAuthRateLimited');
  });
});
