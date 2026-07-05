import { test, expect } from 'bun:test';
import { parisDay } from './day';

// 2026-07-04T00:30:00+02:00 (CEST) == 2026-07-03T22:30:00Z
const localMidnightPlus30 = Date.UTC(2026, 6, 3, 22, 30, 0);
// 2026-07-03T23:30:00+02:00 == 2026-07-03T21:30:00Z (still the 3rd locally)
const beforeLocalMidnight = Date.UTC(2026, 6, 3, 21, 30, 0);

test('rolls over at Paris local midnight, not UTC midnight', () => {
  expect(parisDay(localMidnightPlus30).dayIndex).toBe(
    parisDay(Date.UTC(2026, 6, 4, 10, 0, 0)).dayIndex
  );
  expect(parisDay(beforeLocalMidnight).dayIndex).toBe(parisDay(localMidnightPlus30).dayIndex - 1);
});

test('weekday is Monday-origin', () => {
  // 2026-07-06 is a Monday
  expect(parisDay(Date.UTC(2026, 6, 6, 10, 0, 0)).weekday).toBe(0);
});
