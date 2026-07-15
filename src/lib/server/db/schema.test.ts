import { beforeEach, describe, expect, it } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { testDb, resetTestDb } from '../../../test/db';
import { seedUser, seedChild } from '../../../test/route';
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

  it('sessions exposes a user_id index', () => {
    const cfg = getTableConfig(sessions);
    const idx = cfg.indexes.find((i) => i.config.name === 'sessions_user_id_idx');
    expect(idx).toBeDefined();
  });

  it('memberships exposes a child_id index', () => {
    const cfg = getTableConfig(memberships);
    const idx = cfg.indexes.find((i) => i.config.name === 'memberships_child_id_idx');
    expect(idx).toBeDefined();
  });

  it('invitations exposes created_by and used_by indexes', () => {
    const cfg = getTableConfig(invitations);
    const idxNames = cfg.indexes.map((i) => i.config.name);
    expect(idxNames).toContain('invitations_created_by_idx');
    expect(idxNames).toContain('invitations_used_by_idx');
  });

  it('rejects an invalid food_entries.reaction value via CHECK constraint', async () => {
    await resetTestDb();
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    const [food] = await testDb
      .insert(foods)
      .values({
        name: 'Poire',
        category: 'fruits',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning();

    // Wrap in an async IIFE so bun:test's .rejects sees a real Promise —
    // Drizzle's insert builder is thenable but bun checks isPromise() before
    // awaiting (see texture.test.ts).
    await expect(
      (async () =>
        await testDb.insert(foodEntries).values({
          childId: c.id,
          foodId: food.id,
          givenAt: new Date(),
          reaction: 'not-a-reaction' as never,
          notes: null,
          loggedBy: u.id,
          createdAt: new Date()
        }))()
    ).rejects.toThrow();

    // Control: the same FK values with a valid reaction must succeed, so the
    // failure above is proven to be the CHECK constraint and not a stray
    // FK/NOT-NULL problem.
    const [control] = await testDb
      .insert(foodEntries)
      .values({
        childId: c.id,
        foodId: food.id,
        givenAt: new Date(),
        reaction: 'ras',
        notes: null,
        loggedBy: u.id,
        createdAt: new Date()
      })
      .returning();
    expect(control.reaction).toBe('ras');
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

describe('food_entries.mealId', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  // The test harness (src/test/db.ts) only runs migrations — it does not call
  // the app's seedFoods() (that's src/lib/server/db/index.ts, prod-only) — so
  // every *.test.ts here seeds its own food row, same as symptoms.test.ts.
  async function seedFood(name = 'Carotte') {
    const [row] = await testDb
      .insert(foods)
      .values({
        name,
        category: 'legumes',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning();
    return row;
  }

  it('accepts a mealId group token and rejects duplicate (mealId, foodId)', async () => {
    const user = await seedUser();
    const child = await seedChild({ createdBy: user.id });
    const food = await seedFood();
    const foodId = food.id;

    const base = {
      childId: child.id,
      foodId,
      givenAt: new Date(),
      reaction: 'ras' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      mealId: 'meal-abc'
    };
    await testDb.insert(foodEntries).values(base);

    // same (mealId, foodId) must violate the partial unique index. Wrap in an
    // async IIFE so bun:test's .rejects sees a real Promise — Drizzle's
    // insert builder is thenable but bun checks isPromise() before awaiting
    // (see texture.test.ts).
    await expect((async () => await testDb.insert(foodEntries).values(base))()).rejects.toThrow();

    // a standalone row (mealId null) with the same foodId is fine (repeat logging)
    await testDb.insert(foodEntries).values({ ...base, mealId: null });
  });

  it('ships the unique index as a PARTIAL one (predicate present in the DDL)', () => {
    // The insert-based test above cannot distinguish a partial index from a
    // full UNIQUE(meal_id, food_id): SQLite treats NULLs as distinct in a
    // unique index regardless of any WHERE clause, so both would let the
    // mealId-null repeat through and reject the duplicate. If a future
    // db:generate silently dropped the `.where(...)`, that test would stay
    // green while standalone repeat-logging broke in prod. Guard the predicate
    // directly by reading the shipped index DDL from sqlite_master.
    const rows = testDb.all(
      sql`SELECT sql FROM sqlite_master WHERE type = 'index' AND name = 'food_entries_meal_food_uq'`
    ) as Array<{ sql: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].sql).toMatch(/is not null/i);
  });
});
