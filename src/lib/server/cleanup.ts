import { lt } from 'drizzle-orm';
import { db } from './db';
import { invitations, sessions, webauthnChallenges } from './db/schema';
import { evictExpiredRateLimits } from './rate-limit';

const CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 6;
// Drop a rate-limit bucket whose newest hit is older than the longest auth
// window we care about (1h, the signup limit). Anything older has no effect
// on live throttling and only consumes memory.
const RATE_LIMIT_MAX_AGE_MS = 1000 * 60 * 60;

export type CleanupResult = {
  expiredSessions: number;
  expiredInvitations: number;
  expiredChallenges: number;
  evictedRateLimitBuckets: number;
};

export async function runCleanup(now: Date = new Date()): Promise<CleanupResult> {
  const s = await db.delete(sessions).where(lt(sessions.expiresAt, now));
  const i = await db.delete(invitations).where(lt(invitations.expiresAt, now));
  const c = await db.delete(webauthnChallenges).where(lt(webauthnChallenges.expiresAt, now));
  const evicted = evictExpiredRateLimits(RATE_LIMIT_MAX_AGE_MS, now.getTime());
  return {
    /* v8 ignore next 3 — node-postgres always populates rowCount for DELETE */
    expiredSessions: s.rowCount ?? 0,
    expiredInvitations: i.rowCount ?? 0,
    expiredChallenges: c.rowCount ?? 0,
    evictedRateLimitBuckets: evicted
  };
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startCleanupTimer(): void {
  if (timer) return;
  void runCleanup().catch((err) => {
    console.error('[cleanup] initial run failed:', err);
  });
  timer = setInterval(() => {
    void runCleanup().catch((err) => {
      console.error('[cleanup] scheduled run failed:', err);
    });
  }, CLEANUP_INTERVAL_MS);
  timer.unref?.();
}

export function stopCleanupTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
