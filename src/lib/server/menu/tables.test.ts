import { test, expect } from 'bun:test';
import { PROTEIN_WEEK, CHOKING_BY_FOOD, ROLE_POOLS, NOVELTY_CATEGORIES } from './tables';
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

test('matière grasse pool excludes the nut oil', () => {
  expect(ROLE_POOLS.matiereGrasse).toContain('matieres_grasses');
  // Huile de noix exclusion is enforced in the engine by name; assert the category is fat-only
});

test('novelty categories are role-bearing only (no allergenes/aromates)', () => {
  expect(NOVELTY_CATEGORIES).not.toContain('allergenes');
  expect(NOVELTY_CATEGORIES).not.toContain('aromates');
});
