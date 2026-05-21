// Reminder-dismissal storage and TTL conventions.

import { db } from '$lib/server/db';
import { tipDismissals } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';

const DAY_MS = 24 * 60 * 60 * 1000;

function ttlForReminderKey(key: string): number | null {
  // Conventions:
  //   important reminders are 'welcome', 'stage-transition:*', 'forbidden-reminder:*' → no TTL until conditions clear
  //   warn reminders are 'pending-allergen:*', 'high-risk-window' → 90 days
  //   info reminders are everything else → 30 days
  if (
    key === 'welcome' ||
    key === 'welcome-dialog' ||
    key.startsWith('stage-transition:') ||
    key.startsWith('forbidden-reminder:')
  ) {
    return null;
  }
  if (key.startsWith('pending-allergen:') || key === 'high-risk-window') {
    return 90 * DAY_MS;
  }
  return 30 * DAY_MS;
}

export async function loadDismissals(userId: number, childId: number): Promise<Set<string>> {
  const rows = await db
    .select({ key: tipDismissals.reminderKey, at: tipDismissals.dismissedAt })
    .from(tipDismissals)
    .where(and(eq(tipDismissals.userId, userId), eq(tipDismissals.childId, childId)));
  // Honor TTL by reminderKey prefix (info: 30d, warn: 90d, important: never)
  const now = Date.now();
  const out = new Set<string>();
  for (const r of rows) {
    const at = r.at.getTime();
    const ttl = ttlForReminderKey(r.key);
    if (ttl == null || now - at < ttl) {
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
