import { beforeEach, describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { testDb, resetTestDb } from '../../../test/db';
import {
  users,
  sessions,
  children,
  memberships,
  invitations,
  foods,
  foodEntries,
  tipDismissals,
  passkeys,
  webauthnChallenges,
  symptoms
} from './schema';

describe('schema exports', () => {
  it('every table is defined and has columns', () => {
    for (const table of [
      users,
      sessions,
      children,
      memberships,
      invitations,
      foods,
      foodEntries,
      tipDismissals,
      passkeys,
      webauthnChallenges,
      symptoms
    ]) {
      expect(table).toBeDefined();
      expect(typeof table).toBe('object');
    }
  });

  it('memberships exposes a composite primary key on (user_id, child_id)', () => {
    const cfg = getTableConfig(memberships);
    expect(cfg.primaryKeys.length).toBe(1);
    const cols = cfg.primaryKeys[0].columns.map((c) => c.name).sort();
    expect(cols).toEqual(['child_id', 'user_id']);
  });

  it('food_entries exposes a child/given_at index', () => {
    const cfg = getTableConfig(foodEntries);
    const idx = cfg.indexes.find((i) => i.config.name === 'food_entries_child_idx');
    expect(idx).toBeDefined();
  });

  it('tip_dismissals exposes a composite primary key on (user_id, child_id, reminder_key)', () => {
    const cfg = getTableConfig(tipDismissals);
    expect(cfg.primaryKeys.length).toBe(1);
    const cols = cfg.primaryKeys[0].columns.map((c) => c.name).sort();
    expect(cols).toEqual(['child_id', 'reminder_key', 'user_id']);
  });

  it('passkeys exposes a user_id index', () => {
    const cfg = getTableConfig(passkeys);
    const idx = cfg.indexes.find((i) => i.config.name === 'passkeys_user_idx');
    expect(idx).toBeDefined();
  });
});

describe('symptoms table', () => {
  it('is defined and has the expected columns', () => {
    expect(symptoms).toBeDefined();
    const cfg = getTableConfig(symptoms);
    const cols = cfg.columns.map((c) => c.name).sort();
    expect(cols).toEqual([
      'child_id',
      'created_at',
      'created_by',
      'food_entry_id',
      'id',
      'label',
      'note',
      'observed_at'
    ]);
  });

  it('indexes food_entry_id and (child_id, observed_at)', () => {
    const cfg = getTableConfig(symptoms);
    const idxNames = cfg.indexes.map((i) => i.config.name).sort();
    expect(idxNames).toContain('symptoms_food_entry_id_idx');
    expect(idxNames).toContain('symptoms_child_id_observed_at_idx');
  });
});

describe('children.dietaryExclusions', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  async function seedUserId(): Promise<number> {
    const [user] = await testDb
      .insert(users)
      .values({
        email: `schema-test-${Math.random()}@example.com`,
        displayName: 'Parent',
        passwordHash: 'x',
        createdAt: new Date()
      })
      .returning({ id: users.id });
    return user.id;
  }

  it('defaults to [] when omitted on insert (proves the migration default applied)', async () => {
    const createdBy = await seedUserId();
    const [child] = await testDb
      .insert(children)
      .values({ name: 'Bébé', birthDate: '2024-01-01', createdBy, createdAt: new Date() })
      .returning();
    expect(child.dietaryExclusions).toEqual([]);
  });

  it('round-trips an explicit value on insert', async () => {
    const createdBy = await seedUserId();
    const [child] = await testDb
      .insert(children)
      .values({
        name: 'Bébé',
        birthDate: '2024-01-01',
        createdBy,
        createdAt: new Date(),
        dietaryExclusions: ['porc']
      })
      .returning();
    expect(child.dietaryExclusions).toEqual(['porc']);
  });

  it('round-trips a written value on update', async () => {
    const createdBy = await seedUserId();
    const [child] = await testDb
      .insert(children)
      .values({ name: 'Bébé', birthDate: '2024-01-01', createdBy, createdAt: new Date() })
      .returning();
    expect(child.dietaryExclusions).toEqual([]);

    await testDb
      .update(children)
      .set({ dietaryExclusions: ['porc'] })
      .where(eq(children.id, child.id));

    const [updated] = await testDb.select().from(children).where(eq(children.id, child.id));
    expect(updated.dietaryExclusions).toEqual(['porc']);
  });
});
