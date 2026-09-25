import * as Sentry from '@sentry/sveltekit';
import { lt } from 'drizzle-orm';
import { db } from './db';
import { invitations, sessions, webauthnChallenges } from './db/schema';
import { pruneExpiredKeys } from './idempotency';
import { evictExpiredRateLimits } from './rate-limit';

const CLEANUP_INTERVAL_HOURS = 6;
const CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * CLEANUP_INTERVAL_HOURS;
// Sentry cron monitor: an `in_progress` check-in at start, `ok`/`error` when
// runCleanup settles. A missed check-in (process wedged, timer lost) or an
// overrun alerts from Sentry's side — the run itself has no other watchdog.
const CLEANUP_MONITOR_SLUG = 'diversif-cleanup';
const CLEANUP_MONITOR_CONFIG = {
  schedule: { type: 'interval', value: CLEANUP_INTERVAL_HOURS, unit: 'hour' },
  // Minutes. Every boot also runs (and checks in) immediately, which only
  // ever brings the next expected check-in closer.
  checkinMargin: 30,
  maxRuntime: 5
} as const;

// Drop a rate-limit bucket whose newest hit is older than the longest auth
// window we care about (1h, the signup limit). Anything older has no effect
// on live throttling and only consumes memory.
const RATE_LIMIT_MAX_AGE_MS = 1000 * 60 * 60;

export type CleanupResult = {
  expiredSessions: number;
  expiredInvitations: number;
  expiredChallenges: number;
  expiredIdempotencyKeys: number;
  evictedRateLimitBuckets: number;
};

export async function runCleanup(now: Date = new Date()): Promise<CleanupResult> {
  // Count deletions via .returning().length — bun:sqlite's run result does not
  // expose an affected-rows count on the typed delete builder.
  const s = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });
  const i = await db
    .delete(invitations)
    .where(lt(invitations.expiresAt, now))
    .returning({ code: invitations.code });
  const c = await db
    .delete(webauthnChallenges)
    .where(lt(webauthnChallenges.expiresAt, now))
    .returning({ token: webauthnChallenges.token });
  // idempotency_keys would otherwise grow forever (used to be pruned inside
  // every successful log transaction, which contended on the same row-locks
  // and risked deadlocks under Postgres).
  const k = await pruneExpiredKeys(db);
  const evicted = evictExpiredRateLimits(RATE_LIMIT_MAX_AGE_MS, now.getTime());
  return {
    expiredSessions: s.length,
    expiredInvitations: i.length,
    expiredChallenges: c.length,
    expiredIdempotencyKeys: k,
    evictedRateLimitBuckets: evicted
  };
}

let timer: ReturnType<typeof setInterval> | null = null;

/** One monitored cleanup pass; failures are reported, never thrown. */
async function monitoredCleanup(trigger: 'initial' | 'scheduled'): Promise<void> {
  try {
    const result = await Sentry.withMonitor(
      CLEANUP_MONITOR_SLUG,
      runCleanup,
      CLEANUP_MONITOR_CONFIG
    );
    Sentry.logger.info('Cleanup completed', { trigger, ...result });
  } catch (err) {
    console.error(`[cleanup] ${trigger} run failed:`, err);
    Sentry.captureException(err, { tags: { subsystem: 'cleanup' } });
  }
}

export function startCleanupTimer(): void {
  if (timer) return;
  void monitoredCleanup('initial');
  /* v8 ignore next 3 : interval body fires only after CLEANUP_INTERVAL_MS — bun:test has no fake timers; the initial-run path above exercises the same monitoredCleanup */
  timer = setInterval(() => {
    void monitoredCleanup('scheduled');
  }, CLEANUP_INTERVAL_MS);
  timer.unref?.();
}

export function stopCleanupTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
