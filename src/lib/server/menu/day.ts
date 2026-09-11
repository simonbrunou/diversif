import { parisDayIndex } from '$lib/utils/paris-date';

export function parisDay(nowMs: number): { dayIndex: number; weekday: number } {
  const dayIndex = parisDayIndex(nowMs);
  const weekday = (((dayIndex + 3) % 7) + 7) % 7; // epoch day 0 = Thursday (Monday-origin index 3)
  return { dayIndex, weekday };
}
