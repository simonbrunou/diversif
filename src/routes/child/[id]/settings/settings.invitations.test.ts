import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

const generateInviteCodeRawSpy = mock<() => string>();

// Same live-binding hazard as $lib/utils/invites below — snapshot the
// namespace as a plain object before mock.module replaces it.
import * as actualAuthNs from '$lib/server/auth';
const realAuth: typeof actualAuthNs = { ...actualAuthNs };
mock.module('$lib/server/auth', () => ({
  ...realAuth,
  generateInviteCodeRaw: () => generateInviteCodeRawSpy()
}));

// The shared invitations helper imports generateInviteCodeRaw from
// $lib/utils/invites directly. We intercept it here so the same spy that
// controls the auth re-export also controls the shared module, giving the
// createInvitation collision tests full control over code generation.
//
// Snapshot the real exports as a plain object BEFORE mock.module. ESM
// namespace properties are live bindings — once mock.module replaces the
// module, `actualInvites.x` reads the mocked binding. Both the local
// snapshot AND the factory's spread of actualInvites need to be against
// frozen values, otherwise the spy returned by the factory ends up
// referencing itself and the default beforeEach delegation recurses
// infinitely.
// bun:test's mock.module calls are hoisted above static imports, so the
// usual `import * as actual; snapshot real exports` trick captures the
// already-mocked binding. Hard-code a simple default generator instead —
// matches the real generateInviteCodeRaw's BEBE- prefix pattern. Tests
// that need collision behaviour set .mockImplementation themselves.
import * as actualInvitesNs from '$lib/utils/invites';
const defaultInviteCodeGen = (): string => {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `BEBE-${suffix}`;
};
const _invitesRef = { real: defaultInviteCodeGen };
mock.module('$lib/utils/invites', () => ({
  ...actualInvitesNs,
  generateInviteCodeRaw: () => generateInviteCodeRawSpy()
}));

import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { invitations, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { actions } from './+page.server';
import { PASSWORD, setup } from './settings-test-fixtures';

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
      params: { id: String(c.id) },
      formData: { currentPassword: PASSWORD }
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

  it('requires the current password before creating an invitation', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { currentPassword: 'wrong-password' }
    });
    const r = (await actions.createInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.createInvitation>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
    expect(await testDb.select().from(invitations)).toHaveLength(0);
  });

  it('redirects to /login when the user row vanished mid-session', async () => {
    const { u, c, m } = await setup();
    // Simulate the rare revocation race: the session is still live but the
    // user row is gone — requireFreshAuth's onMissingUser must redirect.
    await testDb.delete(users).where(eq(users.id, u.id));
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { currentPassword: PASSWORD }
    });
    const r = await captureFlow(() =>
      actions.createInvitation!(
        event as unknown as Parameters<NonNullable<typeof actions.createInvitation>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
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
      params: { id: String(c.id) },
      formData: { currentPassword: PASSWORD }
    });
    const r = (await actions.createInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.createInvitation>>[0]
    )) as { status: number };
    expect(r.status).toBe(500);
    expect(generateInviteCodeRawSpy).toHaveBeenCalledTimes(5);
  });

  it('rejects creating an invitation once the active-invite cap is reached', async () => {
    const { u, c, m } = await setup();
    // Seed 10 active (unused, unexpired) invites for this child — the cap.
    for (let i = 0; i < 10; i++) {
      await testDb.insert(invitations).values({
        code: `BEBE-CAP${i}`,
        childId: c.id,
        createdBy: u.id,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 86_400_000),
        usedAt: null,
        usedBy: null
      });
    }
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { currentPassword: PASSWORD }
    });
    const r = (await actions.createInvitation!(
      event as unknown as Parameters<NonNullable<typeof actions.createInvitation>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(429);
    expect(r.data.errorKey).toBe('errorsSettingsInviteCapReached');
    expect(await testDb.select().from(invitations)).toHaveLength(10);
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
      params: { id: String(c.id) },
      formData: { currentPassword: PASSWORD }
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
