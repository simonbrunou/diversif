import { lt } from 'drizzle-orm';
import { db } from './db';
import { invitations, sessions, webauthnChallenges } from './db/schema';

const CLEANUP_INTERVAL_MS = 1000 * 60 * 60 * 6;

export type CleanupResult = {
  expiredSessions: number;
  expiredInvitations: number;
  expiredChallenges: number;
};

export function runCleanup(now: Date = new Date()): CleanupResult {
  const s = db.delete(sessions).where(lt(sessions.expiresAt, now)).run();
  const i = db.delete(invitations).where(lt(invitations.expiresAt, now)).run();
  const c = db.delete(webauthnChallenges).where(lt(webauthnChallenges.expiresAt, now)).run();
  return {
    expiredSessions: s.changes,
    expiredInvitations: i.changes,
    expiredChallenges: c.changes
  };
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startCleanupTimer(): void {
  if (timer) return;
  try {
    runCleanup();
  } catch (err) {
    console.error('[cleanup] initial run failed:', err);
  }
  timer = setInterval(() => {
    try {
      runCleanup();
    } catch (err) {
      console.error('[cleanup] scheduled run failed:', err);
    }
  }, CLEANUP_INTERVAL_MS);
  timer.unref?.();
}

export function stopCleanupTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
