import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser, seedChild, seedUser } from '../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { invitations, memberships, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE } from '$lib/server/auth';
import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { load, actions } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
  _clearAllRateLimits();
});

describe('signup load', () => {
  it('returns empty inviteCode when not in URL', async () => {
    const event = makeRouteEvent({ url: 'http://localhost/signup' });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out).toEqual({ inviteCode: '' });
  });

  it('reads the code from the URL and uppercases it', async () => {
    const event = makeRouteEvent({ url: 'http://localhost/signup?code=bebe-abcdef' });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out).toEqual({ inviteCode: 'BEBE-ABCDEF' });
  });

  it('redirects authenticated users away', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({ user: safeUser(u), url: 'http://localhost/signup' });
    const result = await captureFlow(() => load(event as unknown as Parameters<typeof load>[0]));
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect') expect(result.location).toBe('/');
  });
});

describe('signup default action', () => {
  function form(over: Partial<Record<string, string>> = {}) {
    return {
      email: 'new@example.com',
      password: 'a-very-long-password-12+',
      displayName: 'New User',
      inviteCode: '',
      acceptTos: 'on',
      acceptPrivacy: 'on',
      confirmAge15: 'on',
      ...over
    };
  }

  it('returns 429 when the per-IP rate limit is exceeded', async () => {
    // Saturate the signup bucket (limit 20 per hour per IP). Submit invalid
    // payloads so each call returns fail() instead of throwing redirect; the
    // limit fires before validation runs anyway.
    for (let i = 0; i < 20; i++) {
      const event = makeRouteEvent({ formData: form({ email: 'invalid' }) });
      await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      );
    }
    const blocked = makeRouteEvent({ formData: form({ email: 'invalid' }) });
    const r = (await actions.default!(
      blocked as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(429);
    expect(r.data.errorKey).toBe('errorsAuthRateLimited');
  });

  it('fails on invalid email', async () => {
    const event = makeRouteEvent({ formData: form({ email: 'not-an-email' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.errorKey).toBe('errorsAuthBadInput');
  });

  it('fails on short password', async () => {
    const event = makeRouteEvent({ formData: form({ password: 'short' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.errorKey).toBe('errorsAuthBadInput');
  });

  it('fails on empty displayName', async () => {
    const event = makeRouteEvent({ formData: form({ displayName: '' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.errorKey).toBe('errorsAuthBadInput');
  });

  for (const missing of ['acceptTos', 'acceptPrivacy', 'confirmAge15'] as const) {
    it(`fails when ${missing} is not checked`, async () => {
      const event = makeRouteEvent({ formData: form({ [missing]: undefined }) });
      const r = (await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )) as { status: number; data: { errorKey: string } };
      expect(r.status).toBe(400);
      expect(r.data.errorKey).toBe('errorsAuthBadInput');
    });
  }

  it('returns the same invite-error response for registered and unregistered emails (XOR-resistance)', async () => {
    await seedUser({ email: 'taken@example.com' });
    const ev1 = makeRouteEvent({
      formData: form({ email: 'taken@example.com', inviteCode: 'BAD-CODE' })
    });
    const ev2 = makeRouteEvent({
      formData: form({ email: 'fresh@example.com', inviteCode: 'BAD-CODE' })
    });
    const r1 = (await actions.default!(
      ev1 as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    const r2 = (await actions.default!(
      ev2 as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    // Both must respond with the invite error : varying only the email
    // must not reveal whether the address is on file.
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
    expect(r1.data.errorKey).toBe(r2.data.errorKey);
    expect(r1.data.errorKey).toBe('errorsAuthInvalidInvite');
  });

  it('fails generically when email already exists (no enumeration leak)', async () => {
    await seedUser({ email: 'taken@example.com' });
    const event = makeRouteEvent({ formData: form({ email: 'taken@example.com' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.errorKey).toBe('errorsAuthSignupImpossible');
  });

  it('fails when invite code format is invalid', async () => {
    const event = makeRouteEvent({ formData: form({ inviteCode: 'BAD-CODE' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.errorKey).toBe('errorsAuthInvalidInvite');
  });

  it('fails when invite code is unknown', async () => {
    const event = makeRouteEvent({ formData: form({ inviteCode: 'BEBE-ABCDEF' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.errorKey).toBe('errorsAuthInvalidInviteExpired');
  });

  it('succeeds without invite : sets cookie + redirects /', async () => {
    const event = makeRouteEvent({ formData: form() });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/');
    expect(event.cookies.set).toHaveBeenCalled();
    expect(event.cookies.set.mock.calls[0][0]).toBe(SESSION_COOKIE);
    const created = (
      await testDb.select().from(users).where(eq(users.email, 'new@example.com')).limit(1)
    )[0];
    expect(created).toBeDefined();
  });

  it('succeeds with valid invite : adds membership and redirects to /child/{id}', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await testDb.insert(invitations).values({
      code: 'BEBE-ABCDEF',
      childId: child.id,
      createdBy: owner.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400_000),
      usedAt: null,
      usedBy: null
    });

    const event = makeRouteEvent({
      formData: form({ inviteCode: 'BEBE-ABCDEF' })
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe(`/child/${child.id}`);

    const newUser = (
      await testDb.select().from(users).where(eq(users.email, 'new@example.com')).limit(1)
    )[0];
    expect(newUser).toBeDefined();
    const memb = await testDb.select().from(memberships).where(eq(memberships.userId, newUser!.id));
    expect(memb.length).toBe(1);
    expect(memb[0].role).toBe('member');
    const inv = (
      await testDb.select().from(invitations).where(eq(invitations.code, 'BEBE-ABCDEF')).limit(1)
    )[0];
    expect(inv?.usedAt).not.toBeNull();
    expect(inv?.usedBy).toBe(newUser!.id);
  });

  it('blocks invite-less signup with 403 when INVITE_ONLY is set', async () => {
    process.env.INVITE_ONLY = 'true';
    try {
      const event = makeRouteEvent({ formData: form() });
      const r = (await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )) as { status: number; data: { errorKey: string } };
      expect(r.status).toBe(403);
      expect(r.data.errorKey).toBe('errorsAuthInviteRequired');
      // No account is created when the gate rejects.
      expect(
        await testDb.select().from(users).where(eq(users.email, 'new@example.com'))
      ).toHaveLength(0);
    } finally {
      delete process.env.INVITE_ONLY;
    }
  });

  it('allows signup with a valid invite even when INVITE_ONLY is set', async () => {
    process.env.INVITE_ONLY = 'true';
    try {
      const owner = await seedUser({ email: 'owner@example.com' });
      const child = await seedChild({ createdBy: owner.id });
      await testDb.insert(invitations).values({
        code: 'BEBE-ABCDEF',
        childId: child.id,
        createdBy: owner.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
        usedAt: null,
        usedBy: null
      });
      const event = makeRouteEvent({ formData: form({ inviteCode: 'BEBE-ABCDEF' }) });
      const r = await captureFlow(() =>
        actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
      );
      expect(r.kind).toBe('redirect');
    } finally {
      delete process.env.INVITE_ONLY;
    }
  });

  it('re-throws non-race errors from the signup transaction (so SvelteKit returns 500)', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await testDb.insert(invitations).values({
      code: 'BEBE-ABCDEF',
      childId: child.id,
      createdBy: owner.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400_000),
      usedAt: null,
      usedBy: null
    });

    const txSpy = spyOn(testDb, 'transaction').mockImplementationOnce(() => {
      throw new Error('pool timeout');
    });

    try {
      const event = makeRouteEvent({
        formData: form({ inviteCode: 'BEBE-ABCDEF' })
      });
      await expect(
        actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
      ).rejects.toThrow('pool timeout');
    } finally {
      txSpy.mockRestore();
    }
  });

  it('returns the generic signup-impossible error when a concurrent insert wins the email race', async () => {
    // Plant the conflicting row mid-transaction so the inner INSERT races on
    // the users.email unique constraint and raises 23505. The handler should
    // map that to the same opaque "signup impossible" 400 the registered-email
    // read path returns, NOT a 500.
    const txSpy = spyOn(testDb, 'transaction').mockImplementationOnce((fn) => {
      testDb
        .insert(users)
        .values({
          email: 'new@example.com',
          passwordHash: 'h',
          displayName: 'Other',
          createdAt: new Date()
        })
        .run();
      return testDb.transaction(fn);
    });

    try {
      const event = makeRouteEvent({ formData: form() });
      const r = (await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )) as { status: number; data: { errorKey: string } };
      expect(r.status).toBe(400);
      expect(r.data.errorKey).toBe('errorsAuthSignupImpossible');

      // Only one row exists for the email : the planted one.
      const rows = await testDb.select().from(users).where(eq(users.email, 'new@example.com'));
      expect(rows).toHaveLength(1);
    } finally {
      txSpy.mockRestore();
    }
  });

  it('rolls back the user insert when the invite is consumed mid-transaction', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const racer = await seedUser({ email: 'racer@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await testDb.insert(invitations).values({
      code: 'BEBE-ABCDEF',
      childId: child.id,
      createdBy: owner.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400_000),
      usedAt: null,
      usedBy: null
    });

    // Simulate the race: between the unlocked findActiveInvitation read and
    // the transaction's conditional UPDATE, another claim flips used_at.
    // The transaction throws InviteRace and rolls back the user insert.
    const txSpy = spyOn(testDb, 'transaction').mockImplementationOnce((fn) => {
      testDb
        .update(invitations)
        .set({ usedAt: new Date(), usedBy: racer.id })
        .where(eq(invitations.code, 'BEBE-ABCDEF'))
        .run();
      return testDb.transaction(fn);
    });

    try {
      const event = makeRouteEvent({
        formData: form({ inviteCode: 'BEBE-ABCDEF' })
      });
      const r = (await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )) as { status: number; data: { errorKey: string } };
      expect(r.status).toBe(400);
      expect(r.data.errorKey).toBe('errorsAuthInvalidInviteExpired');

      const newUser = (
        await testDb.select().from(users).where(eq(users.email, 'new@example.com')).limit(1)
      )[0];
      expect(newUser).toBeUndefined();
      const memb = await testDb.select().from(memberships).where(eq(memberships.childId, child.id));
      expect(memb).toHaveLength(0);
    } finally {
      txSpy.mockRestore();
    }
  });
});
