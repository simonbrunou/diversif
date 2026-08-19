import { test, expect } from 'bun:test';
import {
  PROTEIN_WEEK,
  CHOKING_BY_FOOD,
  CHARCUTERIE_MATCHERS,
  PORC_MATCHERS,
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
    'oeufs',
    'viandes',
    'poissons',
    'oeufs',
    'viandes'
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

test('nut oil is not treated as a reliable tree-nut allergen exposure', () => {
  const oil = FOODS_SEED.find((food) => food.name === 'Huile de noix');
  expect(oil?.allergen).toBeUndefined();
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

test('OILY_FISH exact names still match a seed food (rename-drift guard)', () => {
  for (const name of OILY_FISH) expect(names.has(name)).toBe(true);
});
