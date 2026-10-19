// Reminder-dismissal storage. The TTL conventions live in ../dismissal-ttl.ts.

import { db } from '#lib/server/db/index.js';
import { tipDismissals } from '#lib/server/db/schema.js';
import { and, eq } from 'drizzle-orm';
import { ttlForReminderKey } from '../dismissal-ttl';

export async function loadDismissals(userId: number, childId: number): Promise<Set<string>> {
  const rows = await db
    .select({ key: tipDismissals.reminderKey, at: tipDismissals.dismissedAt })
    .from(tipDismissals)
    .where(and(eq(tipDismissals.userId, userId), eq(tipDismissals.childId, childId)));
  // Drop dismissals older than their key's TTL.
  const now = Date.now();
  const out = new Set<string>();
  for (const r of rows) {
    const at = r.at.getTime();
    const ttl = ttlForReminderKey(r.key);
    if (now - at < ttl) {
      out.add(r.key);
    }
  }
  return out;
}

export async function dismissReminder(userId: number, childId: number, key: string): Promise<void> {
  await db
    .insert(tipDismissals)
    .values({ userId, childId, reminderKey: key, dismissedAt: new Date() })
    .onConflictDoUpdate({
      target: [tipDismissals.userId, tipDismissals.childId, tipDismissals.reminderKey],
      set: { dismissedAt: new Date() }
    });
}
