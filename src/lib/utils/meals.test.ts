import { test, expect } from 'bun:test';
import { groupByMeal } from './meals';

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
