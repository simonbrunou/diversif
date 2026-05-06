import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser, seedChild, seedUser } from '../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { invitations, memberships, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE } from '$lib/server/auth';
import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { load, actions } from './+page.server';

beforeEach(() => {
  resetTestDb();
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
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(429);
    expect(r.data.error).toMatch(/trop d['’]inscriptions/i);
  });

  it('fails on invalid email', async () => {
    const event = makeRouteEvent({ formData: form({ email: 'not-an-email' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/email/i);
  });

  it('fails on short password', async () => {
    const event = makeRouteEvent({ formData: form({ password: 'short' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/court|caractères/i);
  });

  it('fails on empty displayName', async () => {
    const event = makeRouteEvent({ formData: form({ displayName: '' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
  });

  for (const missing of ['acceptTos', 'acceptPrivacy', 'confirmAge15'] as const) {
    it(`fails when ${missing} is not checked`, async () => {
      const event = makeRouteEvent({ formData: form({ [missing]: undefined }) });
      const r = (await actions.default!(
        event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )) as { status: number; data: { error: string } };
      expect(r.status).toBe(400);
      expect(r.data.error).toMatch(/accepter|confirmer|15 ans/i);
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
    )) as { status: number; data: { error: string } };
    const r2 = (await actions.default!(
      ev2 as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    // Both must respond with the invite error — varying only the email
    // must not reveal whether the address is on file.
    expect(r1.status).toBe(400);
    expect(r2.status).toBe(400);
    expect(r1.data.error).toBe(r2.data.error);
    expect(r1.data.error).toMatch(/invitation/i);
  });

  it('fails generically when email already exists (no enumeration leak)', async () => {
    await seedUser({ email: 'taken@example.com' });
    const event = makeRouteEvent({ formData: form({ email: 'taken@example.com' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/inscription impossible/i);
    // Must NOT confirm whether the address is on file.
    expect(r.data.error).not.toMatch(/existe/i);
  });

  it('fails when invite code format is invalid', async () => {
    const event = makeRouteEvent({ formData: form({ inviteCode: 'BAD-CODE' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/invalide/i);
  });

  it('fails when invite code is unknown', async () => {
    const event = makeRouteEvent({ formData: form({ inviteCode: 'BEBE-ABCDEF' }) });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { error: string } };
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/introuvable|expir/i);
  });

  it('succeeds without invite — sets cookie + redirects /', async () => {
    const event = makeRouteEvent({ formData: form() });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/');
    expect(event.cookies.set).toHaveBeenCalled();
    expect(event.cookies.set.mock.calls[0][0]).toBe(SESSION_COOKIE);
    const created = testDb.select().from(users).where(eq(users.email, 'new@example.com')).get();
    expect(created).toBeDefined();
  });

  it('succeeds with valid invite — adds membership and redirects to /child/{id}', async () => {
    const owner = await seedUser({ email: 'owner@example.com' });
    const child = seedChild({ createdBy: owner.id });
    testDb
      .insert(invitations)
      .values({
        code: 'BEBE-ABCDEF',
        childId: child.id,
        createdBy: owner.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86400_000),
        usedAt: null,
        usedBy: null
      })
      .run();

    const event = makeRouteEvent({
      formData: form({ inviteCode: 'BEBE-ABCDEF' })
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe(`/child/${child.id}`);

    const newUser = testDb.select().from(users).where(eq(users.email, 'new@example.com')).get();
    expect(newUser).toBeDefined();
    const memb = testDb.select().from(memberships).where(eq(memberships.userId, newUser!.id)).all();
    expect(memb.length).toBe(1);
    expect(memb[0].role).toBe('member');
    const inv = testDb.select().from(invitations).where(eq(invitations.code, 'BEBE-ABCDEF')).get();
    expect(inv?.usedAt).not.toBeNull();
    expect(inv?.usedBy).toBe(newUser!.id);
  });
});
