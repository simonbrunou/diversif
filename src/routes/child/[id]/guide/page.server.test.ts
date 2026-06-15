import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import {
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

// Seed a user + child + owner membership, and return a guard context that
// satisfies the load's requireChildContext(locals, params) prelude (user,
// matching params.id, and a membership row for that child).
async function seedGuarded() {
  const u = await seedUser();
  const c = await seedChild({ createdBy: u.id, birthDate: '2024-01-01' });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  return {
    u,
    c,
    guard: { user: safeUser(u), params: { id: String(c.id) }, memberships: [m] }
  };
}

describe('child/[id]/guide load', () => {
  it('returns currentStageId for the child', async () => {
    const { c, guard } = await seedGuarded();

    const event = makeRouteEvent({
      ...guard,
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.currentStageId).toMatch(/4-6|6-9|9-12|12-36/);
  });

  it('returns 4-6 stage for a very young child', async () => {
    const { c, guard } = await seedGuarded();
    const recent = new Date();
    const dateStr = `${recent.getFullYear()}-${String(recent.getMonth() + 1).padStart(2, '0')}-${String(recent.getDate()).padStart(2, '0')}`;
    const event = makeRouteEvent({
      ...guard,
      parent: async () => ({ child: { id: c.id, birthDate: dateStr } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.currentStageId).toBe('4-6');
  });

  it('returns stages array with expected shape', async () => {
    const { c, guard } = await seedGuarded();

    const event = makeRouteEvent({
      ...guard,
      url: 'http://localhost/',
      parent: async () => ({ child: { id: c.id, birthDate: c.birthDate } })
    });

    const out = await load(event as unknown as Parameters<typeof load>[0]);

    expect(Array.isArray(out.stages)).toBe(true);
    expect(out.stages).toHaveLength(4);
    expect(out.stages[0]).toMatchObject({
      id: '4-6',
      title: expect.any(String),
      oneLiner: expect.any(String),
      principles: expect.any(Array),
      focus: expect.any(Array),
      textures: expect.any(String),
      milkTarget: expect.any(String),
      redFlags: expect.any(Array),
      sources: expect.any(Array)
    });
  });

  it('currentStageId reflects child age', async () => {
    const { c, guard } = await seedGuarded();

    const event = makeRouteEvent({
      ...guard,
      url: 'http://localhost/',
      parent: async () => ({ child: { id: c.id, birthDate: '2022-01-01' } })
    });

    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.currentStageId).toBe('12-36');
  });
});
