export const MONITOR_DURATION_MS = 30 * 60 * 1000;

export type TimerState = { startedAt: number };

function keyFor(entryId: string): string {
  return `monitor-timer:${entryId}`;
}

export function loadTimer(entryId: string): TimerState | null {
  /* v8 ignore next */
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(keyFor(entryId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.startedAt === 'number') {
      return { startedAt: parsed.startedAt };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTimer(entryId: string, startedAt: number): void {
  /* v8 ignore next */
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(keyFor(entryId), JSON.stringify({ startedAt }));
}

export function clearTimer(entryId: string): void {
  /* v8 ignore next */
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(keyFor(entryId));
}

export function remainingMs(state: TimerState, now: number = Date.now()): number {
  const elapsed = now - state.startedAt;
  return Math.max(0, MONITOR_DURATION_MS - elapsed);
}

export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
