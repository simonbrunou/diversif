import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { invitations, memberships } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { load, actions } from './+page.server';
import { _clearAllRateLimits } from '$lib/server/rate-limit';

beforeEach(async () => {
  await resetTestDb();
  _clearAllRateLimits();
});

async function seedInvite(opts: {
  code: string;
  childId: number;
  createdBy: number;
  expiresAt?: Date;
  usedAt?: Date | null;
}) {
  await testDb.insert(invitations).values({
    code: opts.code,
    childId: opts.childId,
    createdBy: opts.createdBy,
    createdAt: new Date(),
    expiresAt: opts.expiresAt ?? new Date(Date.now() + 86400_000),
    usedAt: opts.usedAt ?? null,
    usedBy: null
  });
}

describe('join/[code] load', () => {
  it('returns format error when code is malformed', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      params: { code: 'not-valid' }
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out).toMatchObject({ errorKey: 'errorsAuthInvalidInvite' });
  });

  it('rejects legacy 4-character invite codes as malformed', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      params: { code: 'BEBE-ABCD' }
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out).toMatchObject({ errorKey: 'errorsAuthInvalidInvite' });
  });

  it('redirects guests to /signup with the code', async () => {
    const event = makeRouteEvent({
      user: null,
      params: { code: 'BEBE-ABCDEF' }
    });
    const r = await captureFlow(() => load(event as unknown as Parameters<typeof load>[0]));
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/signup?code=BEBE-ABCDEF');
  });

  it('returns "introuvable ou expiré" when no active invite', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      params: { code: 'BEBE-ZZZZZZ' }
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out).toMatchObject({
      errorKey: 'errorsAuthInvalidInviteExpired'
    });
  });

  it('redirects to /child/{id} when the user is already a member', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const me = await seedUser({ email: 'me@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await seedMembership({ userId: me.id, childId: child.id, role: 'member' });
    await seedInvite({ code: 'BEBE-ABCDEF', childId: child.id, createdBy: owner.id });

    const event = makeRouteEvent({
      user: safeUser(me),
      params: { code: 'BEBE-ABCDEF' }
    });
    const r = await captureFlow(() => load(event as unknown as Parameters<typeof load>[0]));
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe(`/child/${child.id}`);
  });

  it('returns the child preview for a valid invite', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const me = await seedUser({ email: 'me@example.com' });
    const child = await seedChild({ createdBy: owner.id, name: 'Bébé' });
    await seedInvite({ code: 'BEBE-ABCDEF', childId: child.id, createdBy: owner.id });

    const event = makeRouteEvent({
      user: safeUser(me),
      params: { code: 'BEBE-ABCDEF' }
    });
    const out = (await load(event as unknown as Parameters<typeof load>[0])) as {
      errorKey: null;
      code: string;
      child: { id: number; name: string };
      inviter: string | null;
    };
    expect(out.errorKey).toBeNull();
    expect(out.code).toBe('BEBE-ABCDEF');
    expect(out.child.id).toBe(child.id);
    // The invitee sees WHO invited them (createdBy → displayName), not an anonymous code.
    expect(out.inviter).toBe(owner.displayName);
  });

  it('treats a real expired invite as inactive (exercises the expiresAt filter)', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const me = await seedUser({ email: 'me@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    // A row that exists but expired one second ago — distinct from the
    // "no row at all" path (BEBE-ZZZZZZ) the other tests exercise.
    await seedInvite({
      code: 'BEBE-ABCDEF',
      childId: child.id,
      createdBy: owner.id,
      expiresAt: new Date(Date.now() - 1000)
    });
    const event = makeRouteEvent({ user: safeUser(me), params: { code: 'BEBE-ABCDEF' } });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out).toMatchObject({ errorKey: 'errorsAuthInvalidInviteExpired', child: null });
  });

  it('treats an already-redeemed invite as inactive (exercises the usedAt filter)', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const me = await seedUser({ email: 'me@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await seedInvite({
      code: 'BEBE-ABCDEF',
      childId: child.id,
      createdBy: owner.id,
      usedAt: new Date()
    });
    const event = makeRouteEvent({ user: safeUser(me), params: { code: 'BEBE-ABCDEF' } });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out).toMatchObject({ errorKey: 'errorsAuthInvalidInviteExpired', child: null });
  });

  it('rate-limits authenticated invite lookups', async () => {
    const u = await seedUser();
    for (let i = 0; i < 20; i++) {
      await load(
        makeRouteEvent({
          user: safeUser(u),
          params: { code: 'BEBE-ZZZZZZ' }
        }) as unknown as Parameters<typeof load>[0]
      );
    }
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(u),
          params: { code: 'BEBE-ZZZZZZ' }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(429);
  });
});

describe('join/[code] default action', () => {
  it('fails on invalid code format', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      params: { code: 'bad' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.errorKey).toBe('errorsAuthInvalidInvite');
  });

  it('redirects guests to /signup', async () => {
    const event = makeRouteEvent({
      user: null,
      params: { code: 'BEBE-ABCDEF' }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/signup?code=BEBE-ABCDEF');
  });

  it('fails when invite is unknown / expired', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      params: { code: 'BEBE-ZZZZZZ' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.errorKey).toBe('errorsAuthInvalidInviteExpired');
  });

  it('redirects when user is already a member', async () => {
    const owner = await seedUser({ email: 'o@example.com' });
    const me = await seedUser({ email: 'm@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await seedMembership({ userId: me.id, childId: child.id, role: 'member' });
    await seedInvite({ code: 'BEBE-ABCDEF', childId: child.id, createdBy: owner.id });

    const event = makeRouteEvent({
      user: safeUser(me),
      params: { code: 'BEBE-ABCDEF' }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe(`/child/${child.id}`);
  });

  it('joins the child + consumes the invite + redirects on success', async () => {
    const owner = await seedUser({ email: 'o@example.com' });
    const me = await seedUser({ email: 'm@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await seedInvite({ code: 'BEBE-ABCDEF', childId: child.id, createdBy: owner.id });

    const event = makeRouteEvent({
      user: safeUser(me),
      params: { code: 'BEBE-ABCDEF' }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');

    const memb = await testDb.select().from(memberships).where(eq(memberships.userId, me.id));
    expect(memb.length).toBe(1);
    expect(memb[0].role).toBe('member');

    const inv = (
      await testDb.select().from(invitations).where(eq(invitations.code, 'BEBE-ABCDEF')).limit(1)
    )[0];
    expect(inv?.usedAt).not.toBeNull();
    expect(inv?.usedBy).toBe(me.id);
  });

  it('rejects with "introuvable ou expiré" when another claim consumes the invite mid-transaction', async () => {
    const owner = await seedUser({ email: 'o@example.com' });
    const me = await seedUser({ email: 'm@example.com' });
    const racer = await seedUser({ email: 'r@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await seedInvite({ code: 'BEBE-ABCDEF', childId: child.id, createdBy: owner.id });

    // Simulate the race: between findActiveInvitation (read) and the
    // transaction's UPDATE, another claim flips used_at. The transaction's
    // conditional WHERE used_at IS NULL should match 0 rows and we should
    // bail without inserting a membership row for `me`.
    const txSpy = spyOn(testDb, 'transaction').mockImplementationOnce(async (fn) => {
      await testDb
        .update(invitations)
        .set({ usedAt: new Date(), usedBy: racer.id })
        .where(eq(invitations.code, 'BEBE-ABCDEF'));
      return testDb.transaction(fn);
    });

    try {
      const event = makeRouteEvent({
        user: safeUser(me),
        params: { code: 'BEBE-ABCDEF' }
      });
      const r = (await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )) as { status: number; data: { errorKey: string } };
      expect(r.status).toBe(400);
      expect(r.data.errorKey).toBe('errorsAuthInvalidInviteExpired');

      const memb = await testDb.select().from(memberships).where(eq(memberships.userId, me.id));
      expect(memb).toHaveLength(0);
    } finally {
      txSpy.mockRestore();
    }
  });

  it('fails for a real expired invite and creates no membership', async () => {
    const owner = await seedUser({ email: 'o@example.com' });
    const me = await seedUser({ email: 'm@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await seedInvite({
      code: 'BEBE-ABCDEF',
      childId: child.id,
      createdBy: owner.id,
      expiresAt: new Date(Date.now() - 1000)
    });
    const event = makeRouteEvent({ user: safeUser(me), params: { code: 'BEBE-ABCDEF' } });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(400);
    const memb = await testDb.select().from(memberships).where(eq(memberships.userId, me.id));
    expect(memb).toHaveLength(0);
  });

  it('fails for an already-redeemed invite and creates no membership', async () => {
    const owner = await seedUser({ email: 'o@example.com' });
    const me = await seedUser({ email: 'm@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await seedInvite({
      code: 'BEBE-ABCDEF',
      childId: child.id,
      createdBy: owner.id,
      usedAt: new Date()
    });
    const event = makeRouteEvent({ user: safeUser(me), params: { code: 'BEBE-ABCDEF' } });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(400);
    const memb = await testDb.select().from(memberships).where(eq(memberships.userId, me.id));
    expect(memb).toHaveLength(0);
  });

  it('lets the owner redeem their own code without duplicating membership or consuming the invite', async () => {
    const owner = await seedUser({ email: 'o@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await seedMembership({ userId: owner.id, childId: child.id, role: 'owner' });
    await seedInvite({ code: 'BEBE-ABCDEF', childId: child.id, createdBy: owner.id });

    const event = makeRouteEvent({ user: safeUser(owner), params: { code: 'BEBE-ABCDEF' } });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    // Already-a-member short-circuit redirects to the child without touching state.
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe(`/child/${child.id}`);

    const memb = await testDb.select().from(memberships).where(eq(memberships.childId, child.id));
    expect(memb).toHaveLength(1); // still just the owner, no second row
    const inv = (
      await testDb.select().from(invitations).where(eq(invitations.code, 'BEBE-ABCDEF')).limit(1)
    )[0];
    expect(inv?.usedAt).toBeNull(); // the code was NOT consumed
  });

  it('rejects a second redemption of the same code by the same user', async () => {
    const owner = await seedUser({ email: 'o@example.com' });
    const me = await seedUser({ email: 'm@example.com' });
    const child = await seedChild({ createdBy: owner.id });
    await seedInvite({ code: 'BEBE-ABCDEF', childId: child.id, createdBy: owner.id });

    const mkEvent = () =>
      makeRouteEvent({
        user: safeUser(me),
        params: { code: 'BEBE-ABCDEF' }
      }) as unknown as Parameters<NonNullable<typeof actions.default>>[0];

    // First redemption joins the child.
    const first = await captureFlow(() => actions.default!(mkEvent()));
    expect(first.kind).toBe('redirect');

    // Second redemption: the invite is now consumed (usedAt set), so
    // findActiveInvitation returns nothing → fail(400), and no second
    // membership row is created.
    const second = (await actions.default!(mkEvent())) as { status: number };
    expect(second.status).toBe(400);
    const memb = await testDb.select().from(memberships).where(eq(memberships.userId, me.id));
    expect(memb).toHaveLength(1);
  });
});
