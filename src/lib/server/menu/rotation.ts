// Deterministic slot rotation. Reuses the day-index idiom from
// guidance.ts:pickRotatingTip, but indexes the CALLER's compacted list so
// consecutive days pick adjacent entries (no consecutive-day repeat when n>=2).
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0; // unsigned 32-bit
}

export function rotatePick<T>(items: T[], key: string, step: number): T | null {
  const n = items.length;
  if (n === 0) return null;
  const idx = (((step + fnv1a(key)) % n) + n) % n;
  return items[idx];
}
