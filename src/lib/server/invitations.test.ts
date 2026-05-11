import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';
import { seedChild, seedUser, seedMembership } from '../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

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
});
