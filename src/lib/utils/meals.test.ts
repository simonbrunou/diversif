import { test, expect } from 'bun:test';
import { groupByMeal } from './meals';
import type { RecentEntry } from '$lib/types';

const row = (id: number, mealId: string | null, reaction: 'ras' | 'inconfort' | 'reaction') => ({
  id,
  mealId,
  reaction,
  givenAt: 1000 - id
});

test('groups consecutive same-mealId rows and derives worst-of reaction', () => {
  const groups = groupByMeal([
    row(1, 'm1', 'ras'),
    row(2, 'm1', 'reaction'),
    row(3, null, 'inconfort')
  ]);
  expect(groups.length).toBe(2);
  expect(groups[0].members.map((m) => m.id)).toEqual([1, 2]);
  expect(groups[0].worst).toBe('reaction');
  expect(groups[1].members.map((m) => m.id)).toEqual([3]);
  expect(groups[1].worst).toBe('inconfort');
});

test('two distinct meals sharing a givenAt stay separate', () => {
  const groups = groupByMeal([
    { id: 5, mealId: 'a', reaction: 'ras' as const, givenAt: 999 },
    { id: 6, mealId: 'b', reaction: 'ras' as const, givenAt: 999 }
  ]);
  expect(groups.map((g) => g.mealId)).toEqual(['a', 'b']);
});

test('two consecutive rows with an undefined mealId stay separate singletons (fail-safe)', () => {
  // `mealId` is typed `string | null`; an `undefined` is a contract violation
  // (cast through unknown to simulate it, e.g. a fixture that forgot the field).
  // The loose `!= null` guard must force each such row to its OWN singleton and
  // never collapse two unrelated rows into one merged "meal". This locks the
  // fail-safe against a future re-tightening to `!==`, which would compare
  // `undefined === undefined` and wrongly merge them.
  const undef = (id: number) =>
    ({ id, mealId: undefined, reaction: 'ras', givenAt: 1000 - id }) as unknown as RecentEntry;
  const groups = groupByMeal([undef(1), undef(2)]);
  expect(groups.length).toBe(2);
  expect(groups.map((g) => g.members.map((m) => m.id))).toEqual([[1], [2]]);
});
