// Reminder dismissals, per viewer and child. How long each one holds is the
// reminder policy's call: ttlForReminderKey in ./reminders.ts.

import { db } from '#lib/server/db/index.js';
import { tipDismissals } from '#lib/server/db/schema.js';
import { and, eq } from 'drizzle-orm';
import { ttlForReminderKey } from './reminders';

/** The keys this viewer dismissed for this child and whose TTL hasn't run out at `now`. */
export async function loadDismissals(
  userId: number,
  childId: number,
  now: number
): Promise<Set<string>> {
  const rows = await db
    .select({ key: tipDismissals.reminderKey, at: tipDismissals.dismissedAt })
    .from(tipDismissals)
    .where(and(eq(tipDismissals.userId, userId), eq(tipDismissals.childId, childId)));
  const out = new Set<string>();
  for (const r of rows) {
    if (now - r.at.getTime() < ttlForReminderKey(r.key)) out.add(r.key);
  }
  return out;
}

/** Records that this viewer dismissed `key` at `now`; dismissing it again restarts its TTL. */
export async function dismissReminder(
  userId: number,
  childId: number,
  key: string,
  now: number
): Promise<void> {
  const dismissedAt = new Date(now);
  await db
    .insert(tipDismissals)
    .values({ userId, childId, reminderKey: key, dismissedAt })
    .onConflictDoUpdate({
      target: [tipDismissals.userId, tipDismissals.childId, tipDismissals.reminderKey],
      set: { dismissedAt }
    });
}
