import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import { makeRouteEvent, safeUser, seedMembership, seedUser } from '../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { memberships } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { actions } from './+page.server';
import { setup } from './settings-test-fixtures';

beforeEach(async () => {
  await resetTestDb();
  _clearAllRateLimits();
});

describe('settings removeMember action', () => {
  it('fails on non-numeric userId', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { userId: 'abc' }
    });
    const r = (await actions.removeMember!(
      event as unknown as Parameters<NonNullable<typeof actions.removeMember>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('refuses self-removal', async () => {
    const { u, c, m } = await setup();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { userId: String(u.id) }
    });
    const r = (await actions.removeMember!(
      event as unknown as Parameters<NonNullable<typeof actions.removeMember>>[0]
    )) as { status: number; data: { errorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.errorKey).toBe('errorsSettingsMemberSelfRemoval');
  });

  it('removes another member', async () => {
    const { u, c, m } = await setup();
    const other = await seedUser({ email: 'other@example.com' });
    await seedMembership({ userId: other.id, childId: c.id, role: 'member' });
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m],
      params: { id: String(c.id) },
      formData: { userId: String(other.id) }
    });
    const r = (await actions.removeMember!(
      event as unknown as Parameters<NonNullable<typeof actions.removeMember>>[0]
    )) as { success: string };
    expect(r.success).toBeTruthy();
    const remaining = await testDb.select().from(memberships).where(eq(memberships.childId, c.id));
    expect(remaining.find((mm) => mm.userId === other.id)).toBeUndefined();
  });
});
