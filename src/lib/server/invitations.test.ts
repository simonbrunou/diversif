import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';
import { seedChild, seedUser, seedMembership } from '../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

// Force the code generator to a single deterministic value so the
// collision-exhaustion path can be exercised: with every attempt producing
// the same code, pre-seeding that code makes all 5 inserts collide.
mock.module('$lib/utils/invites', () => ({
  generateInviteCodeRaw: () => 'BEBE-AAAAAA'
}));

import { invitations } from './db/schema';
import { createInvitationForChild } from './invitations';

beforeEach(async () => {
  await resetTestDb();
});

describe('createInvitationForChild', () => {
  it('inserts a new invitation row and returns the code', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const code = await createInvitationForChild({ childId: c.id, createdBy: u.id });
    expect(code).toBeTruthy();
    expect(typeof code).toBe('string');
    expect(code!.length).toBeGreaterThanOrEqual(6);
    const rows = await testDb.select().from(invitations);
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe(code);
    expect(rows[0].childId).toBe(c.id);
    expect(rows[0].createdBy).toBe(u.id);
    expect(rows[0].usedAt).toBeNull();
  });

  it('sets an expires_at ~7 days in the future', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const before = Date.now();
    await createInvitationForChild({ childId: c.id, createdBy: u.id });
    const [row] = await testDb.select().from(invitations);
    const expiresAtMs = row.expiresAt.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAtMs - before).toBeGreaterThan(sevenDaysMs - 60_000);
    expect(expiresAtMs - before).toBeLessThan(sevenDaysMs + 60_000);
  });

  it('returns null after 5 colliding code generations', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    // Pre-seed the (now deterministic) code so every one of the 5 insert
    // attempts hits the unique-violation retry and the loop exhausts.
    await testDb.insert(invitations).values({
      code: 'BEBE-AAAAAA',
      childId: c.id,
      createdBy: u.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400_000),
      usedAt: null,
      usedBy: null
    });
    const code = await createInvitationForChild({ childId: c.id, createdBy: u.id });
    expect(code).toBeNull();
    // No extra rows were written (still just the pre-seeded one).
    expect(await testDb.select().from(invitations)).toHaveLength(1);
  });
});
