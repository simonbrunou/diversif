import { test, expect } from 'bun:test';
import {
  PROTEIN_WEEK,
  CHOKING_BY_FOOD,
  NOVELTY_CATEGORIES,
  CHARCUTERIE_MATCHERS,
  PORC_MATCHERS,
  FAT_EXCLUDE,
  OILY_FISH
} from './tables';
import { FOODS_SEED } from '$lib/server/db/seed';

const names = new Set(FOODS_SEED.map((f) => f.name));

test('PROTEIN_WEEK has 7 days with fish twice', () => {
  expect(PROTEIN_WEEK).toHaveLength(7);
  expect(PROTEIN_WEEK.filter((c) => c === 'poissons')).toHaveLength(2);
  expect(PROTEIN_WEEK).toEqual([
    'viandes',
    'poissons',
    'legumineuses',
    'oeufs',
    'poissons',
    'viandes',
    'legumineuses'
  ]);
});

test('CHOKING_BY_FOOD keys all exist in the seed (no orphans)', () => {
  for (const k of Object.keys(CHOKING_BY_FOOD)) expect(names.has(k)).toBe(true);
});

test('known choke-relevant foods are covered (incl. whole round berries)', () => {
  for (const f of [
    'Tomate',
    'Raisin (coupé en 4)',
    'Carotte',
    'Pomme',
    'Concombre',
    'Poivron',
    'Salade verte',
    'Myrtille',
    'Cassis'
  ]) {
    expect(CHOKING_BY_FOOD[f]).toBeDefined();
  }
});

test('FAT_EXCLUDE names the nut oil (the engine enforces the exclusion by name)', () => {
  // The former version of this test only checked ROLE_POOLS.matiereGrasse
  // pool-membership by category, which passes regardless of FAT_EXCLUDE's
  // contents — it never actually asserted the nut oil is excluded. The
  // engine-level exclusion test (engine.test.ts: "safeForRole(matiereGrasse)
  // excludes the nut oil") is the real behavioral guard; this one just pins
  // down the data this table declares.
  expect(FAT_EXCLUDE).toContain('Huile de noix');
});

test('novelty categories are role-bearing only (no allergenes/aromates)', () => {
  expect(NOVELTY_CATEGORIES).not.toContain('allergenes');
  expect(NOVELTY_CATEGORIES).not.toContain('aromates');
});

// ---------------------------------------------------------------------------
// Seed-drift guards, mirroring the SOFT_CHEESE guard in engine.test.ts: a
// future seed rename must not silently no-op a safety exclusion AND make the
// engine's assertions (e.g. "Jambon is never a protéine") pass vacuously.
// ---------------------------------------------------------------------------

test('CHARCUTERIE_MATCHERS/PORC_MATCHERS substrings still match a seed food (rename-drift guard)', () => {
  // Both are SUBSTRING matchers (f.name.includes(m)) — assert each still
  // matches at least one real seed food name.
  for (const matcher of CHARCUTERIE_MATCHERS) {
    expect([...names].some((n) => n.includes(matcher))).toBe(true);
  }
  for (const matcher of PORC_MATCHERS) {
    expect([...names].some((n) => n.includes(matcher))).toBe(true);
  }
});

test('FAT_EXCLUDE/OILY_FISH exact names still match a seed food (rename-drift guard)', () => {
  // Both are EXACT-name matchers (array.includes(f.name)) — assert each
  // entry equals a real seed food name.
  for (const name of FAT_EXCLUDE) expect(names.has(name)).toBe(true);
  for (const name of OILY_FISH) expect(names.has(name)).toBe(true);
});
