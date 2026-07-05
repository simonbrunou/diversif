import { test, expect } from 'bun:test';
import { fnv1a, rotatePick } from './rotation';

test('fnv1a is unsigned and stable', () => {
  const h = fnv1a('child:1:midi:legume');
  expect(h).toBeGreaterThanOrEqual(0);
  expect(h).toBe(fnv1a('child:1:midi:legume'));
});

test('rotatePick never returns undefined for a non-empty list', () => {
  const items = ['a', 'b', 'c'];
  for (let d = 0; d < 20; d++) expect(items).toContain(rotatePick(items, 'k', d));
});

test('rotatePick has no consecutive-day repeat when length >= 2', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  for (let d = 0; d < 30; d++) {
    expect(rotatePick(items, 'k', d)).not.toBe(rotatePick(items, 'k', d + 1));
  }
});

test('rotatePick returns null on empty', () => {
  expect(rotatePick([], 'k', 3)).toBeNull();
});
