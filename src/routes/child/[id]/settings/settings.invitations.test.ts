import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import { makeRouteEvent, safeUser } from '../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

const generateInviteCodeRawSpy = mock<() => string>();

import * as actualAuth from '$lib/server/auth';
mock.module('$lib/server/auth', () => ({
  ...actualAuth,
  generateInviteCodeRaw: () => generateInviteCodeRawSpy()
}));

// The shared invitations helper imports generateInviteCodeRaw from
// $lib/utils/invites directly. We intercept it here so the same spy that
// controls the auth re-export also controls the shared module, giving the
// createInvitation collision tests full control over code generation.
// Capture the actual export via a static import BEFORE mock.module —
// otherwise the factory's await import recurses through its own mock.
import * as actualInvites from '$lib/utils/invites';
const _invitesRef = { real: actualInvites.generateInviteCodeRaw as () => string };
mock.module('$lib/utils/invites', () => ({
  ...actualInvites,
  generateInviteCodeRaw: () => generateInviteCodeRawSpy()
}));

import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { invitations } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { actions } from './+page.server';
import { setup } from './settings-test-fixtures';

beforeEach(async () => {
  await resetTestDb();
  _clearAllRateLimits();
  generateInviteCodeRawSpy.mockReset();
  generateInviteCodeRawSpy.mockImplementation(() => _invitesRef.real!());
});

describe('settings createInvitation action', () => {
  it('inserts an invitation with a generated code', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) }
    });
    const r = (await actions.createInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.createInvitation>>[0]
    )) as { success: string; code: string };
    expect(r.code).toMatch(/^BEBE-/);
    const stored = (
      await testDb.select().from(invitations).where(eq(invitations.code, r.code)).limit(1)
    )[0];
    expect(stored).toBeDefined();
  });

  it('returns the failure key after 5 colliding attempts', async () => {
    const { u, c, m } = await setup();
    // Pre-seed the only code the rng will offer; every attempt collides
    // and the action falls through to the "couldn't generate unique" failure
    // without wedging or hanging.
    await testDb.insert(invitations).values({
      code: 'BEBE-CCCCCC',
      childId: c.id,
      createdBy: u.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: null,
      usedBy: null
    });
    generateInviteCodeRawSpy.mockReturnValue('BEBE-CCCCCC');
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) }
    });
    const r = (await actions.createInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.createInvitation>>[0]
    )) as { status: number };
    expect(r.status).toBe(500);
    expect(generateInviteCodeRawSpy).toHaveBeenCalledTimes(5);
  });

  it('retries on a 23505 collision and lands on the next generated code', async () => {
    const { u, c, m } = await setup();
    // Pre-seed the collision target so the first INSERT will hit
    // invitations_pkey (code is the primary key) and raise 23505. The
    // second attempt picks a fresh code and succeeds.
    await testDb.insert(invitations).values({
      code: 'BEBE-AAAAAA',
      childId: c.id,
      createdBy: u.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
      usedAt: null,
      usedBy: null
    });
    generateInviteCodeRawSpy.mockReturnValueOnce('BEBE-AAAAAA').mockReturnValueOnce('BEBE-BBBBBB');
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) }
    });
    const r = (await actions.createInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.createInvitation>>[0]
    )) as { success: string; code: string };
    expect(r.code).toBe('BEBE-BBBBBB');
    expect(generateInviteCodeRawSpy).toHaveBeenCalledTimes(2);
  });
});

describe('settings revokeInvitation action', () => {
  it('fails when code missing', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: {}
    });
    const r = (await actions.revokeInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.revokeInvitation>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('deletes the matching invitation', async () => {
    const { u, c, m } = await setup();
    await testDb.insert(invitations).values({
      code: 'BEBE-ZZZZZZ',
      childId: c.id,
      createdBy: u.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400_000),
      usedAt: null,
      usedBy: null
    });
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { code: 'BEBE-ZZZZZZ' }
    });
    const r = (await actions.revokeInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.revokeInvitation>>[0]
    )) as { success: string };
    expect(r.success).toBeTruthy();
    const stored = (
      await testDb.select().from(invitations).where(eq(invitations.code, 'BEBE-ZZZZZZ')).limit(1)
    )[0];
    expect(stored).toBeUndefined();
  });
});
