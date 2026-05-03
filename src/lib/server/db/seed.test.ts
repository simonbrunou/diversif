import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';
import { FOODS_SEED, seedFoods } from './seed';
import { foods } from './schema';

beforeEach(() => {
  resetTestDb();
});

describe('FOODS_SEED catalog', () => {
  it('every entry has the required shape', () => {
    for (const f of FOODS_SEED) {
      expect(typeof f.name).toBe('string');
      expect(f.name.length).toBeGreaterThan(0);
      expect(typeof f.category).toBe('string');
      expect(typeof f.age).toBe('number');
      if (f.allergen != null) expect(typeof f.allergen).toBe('string');
    }
  });

  it('food names are unique', () => {
    const names = FOODS_SEED.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('seedFoods', () => {
  it('inserts every seed row when foods table is empty', () => {
    seedFoods(testDb);
    const rows = testDb.select().from(foods).all();
    expect(rows.length).toBe(FOODS_SEED.length);
    const major = rows.filter((r) => r.isMajorAllergen);
    expect(major.length).toBeGreaterThan(0);
    for (const m of major) expect(m.allergenType).not.toBeNull();
  });

  it('is a no-op when foods already exist', () => {
    seedFoods(testDb);
    const before = testDb.select().from(foods).all().length;
    seedFoods(testDb);
    const after = testDb.select().from(foods).all().length;
    expect(after).toBe(before);
  });
});
