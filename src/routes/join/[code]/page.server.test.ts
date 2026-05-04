import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { invitations, memberships } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { load, actions } from './+page.server';

beforeEach(() => {
  resetTestDb();
});

async function seedInvite(opts: {
  code: string;
  childId: number;
  createdBy: number;
  expiresAt?: Date;
  usedAt?: Date | null;
}) {
  testDb
    .insert(invitations)
    .values({
      code: opts.code,
      childId: opts.childId,
      createdBy: opts.createdBy,
      createdAt: new Date(),
      expiresAt: opts.expiresAt ?? new Date(Date.now() + 86400_000),
      usedAt: opts.usedAt ?? null,
      usedBy: null
    })
    .run();
}

describe('join/[code] load', () => {
  it('returns format error when code is malformed', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      params: { code: 'not-valid' }
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out).toMatchObject({ error: expect.stringMatching(/invalide/i) });
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
      error: expect.stringMatching(/introuvable|expir/i)
    });
  });

  it('redirects to /child/{id} when the user is already a member', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const me = await seedUser({ email: 'me@example.com' });
    const child = seedChild({ createdBy: owner.id });
    seedMembership({ userId: me.id, childId: child.id, role: 'member' });
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
    const child = seedChild({ createdBy: owner.id, name: 'Bébé' });
    await seedInvite({ code: 'BEBE-ABCDEF', childId: child.id, createdBy: owner.id });

    const event = makeRouteEvent({
      user: safeUser(me),
      params: { code: 'BEBE-ABCDEF' }
    });
    const out = (await load(event as unknown as Parameters<typeof load>[0])) as {
      error: null;
      code: string;
      child: { id: number; name: string };
    };
    expect(out.error).toBeNull();
    expect(out.code).toBe('BEBE-ABCDEF');
    expect(out.child.id).toBe(child.id);
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
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
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
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
  });

  it('redirects when user is already a member', async () => {
    const owner = await seedUser({ email: 'o@example.com' });
    const me = await seedUser({ email: 'm@example.com' });
    const child = seedChild({ createdBy: owner.id });
    seedMembership({ userId: me.id, childId: child.id, role: 'member' });
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
    const child = seedChild({ createdBy: owner.id });
    await seedInvite({ code: 'BEBE-ABCDEF', childId: child.id, createdBy: owner.id });

    const event = makeRouteEvent({
      user: safeUser(me),
      params: { code: 'BEBE-ABCDEF' }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');

    const memb = testDb.select().from(memberships).where(eq(memberships.userId, me.id)).all();
    expect(memb.length).toBe(1);
    expect(memb[0].role).toBe('member');

    const inv = testDb.select().from(invitations).where(eq(invitations.code, 'BEBE-ABCDEF')).get();
    expect(inv?.usedAt).not.toBeNull();
    expect(inv?.usedBy).toBe(me.id);
  });
});
