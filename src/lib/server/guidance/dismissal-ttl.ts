// How long a reminder dismissal holds. Pure (no DB) so tests can pin each
// reminder family's TTL against the severity its reminders are built with.

import type { Severity } from './reminders';

const DAY_MS = 24 * 60 * 60 * 1000;

// A dismissed important reminder never comes back.
export const TTL_BY_SEVERITY: Record<Severity, number> = {
  important: Infinity,
  warn: 90 * DAY_MS,
  info: 30 * DAY_MS
};

// Severity per key family. Must match the `severity` each reminder is built
// with: reminders.test.ts checks the families computeReminders builds, and
// routes/child/[id]/page.server.test.ts checks observation-window. A Map, not
// an object, so a client-supplied key like 'constructor' can't resolve to an
// Object.prototype member.
export const SEVERITY_BY_KEY_FAMILY: ReadonlyMap<string, Severity> = new Map([
  ['welcome', 'important'],
  ['welcome-dialog', 'important'], // the WelcomeDialog, not a reminder card
  ['stage-transition', 'important'],
  ['forbidden-reminder', 'important'],
  ['pending-allergen', 'warn'],
  ['observation-window', 'warn'], // built in routes/child/[id]/+page.server.ts
  ['stale-diversity', 'info'],
  ['repeat-exposure', 'info'],
  ['category-imbalance', 'info'],
  ['maintain-allergen', 'info']
]);

// The key up to its first ':' ('pending-allergen:oeuf' → 'pending-allergen').
export function keyFamily(key: string): string {
  return key.split(':', 1)[0];
}

// Unknown families get the info TTL, the shortest.
export function ttlForReminderKey(key: string): number {
  return TTL_BY_SEVERITY[SEVERITY_BY_KEY_FAMILY.get(keyFamily(key)) ?? 'info'];
}
