import { beforeEach, describe, expect, it, setSystemTime } from 'bun:test';
import {
  loadTimer,
  saveTimer,
  clearTimer,
  remainingMs,
  MONITOR_DURATION_MS,
  formatRemaining
} from './monitor-timer';

describe('monitor-timer storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and reads back a started-at value', () => {
    saveTimer('entry-42', 1_700_000_000_000);
    expect(loadTimer('entry-42')).toEqual({ startedAt: 1_700_000_000_000 });
  });

  it('returns null when no timer is set', () => {
    expect(loadTimer('entry-42')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    localStorage.setItem('monitor-timer:entry-42', 'not-json');
    expect(loadTimer('entry-42')).toBeNull();
  });

  it('returns null when startedAt is missing', () => {
    localStorage.setItem('monitor-timer:entry-42', JSON.stringify({ foo: 'bar' }));
    expect(loadTimer('entry-42')).toBeNull();
  });

  it('clearTimer removes the key', () => {
    saveTimer('entry-42', 1_700_000_000_000);
    clearTimer('entry-42');
    expect(loadTimer('entry-42')).toBeNull();
  });
});

describe('remainingMs', () => {
  it('returns full duration when timer just started', () => {
    setSystemTime(new Date()); /* [bun-test] was useFakeTimers() */
    setSystemTime(1_700_000_000_000);
    expect(remainingMs({ startedAt: 1_700_000_000_000 })).toBe(MONITOR_DURATION_MS);
    setSystemTime(null);
  });

  it('returns 0 when duration has elapsed', () => {
    setSystemTime(new Date()); /* [bun-test] was useFakeTimers() */
    setSystemTime(1_700_000_000_000 + MONITOR_DURATION_MS + 1000);
    expect(remainingMs({ startedAt: 1_700_000_000_000 })).toBe(0);
    setSystemTime(null);
  });

  it('returns positive remaining when mid-flight', () => {
    setSystemTime(new Date()); /* [bun-test] was useFakeTimers() */
    setSystemTime(1_700_000_000_000 + 5_000);
    expect(remainingMs({ startedAt: 1_700_000_000_000 })).toBe(MONITOR_DURATION_MS - 5000);
    setSystemTime(null);
  });
});

describe('formatRemaining', () => {
  it('formats remaining ms as MM:SS', () => {
    expect(formatRemaining(30 * 60 * 1000)).toBe('30:00');
    expect(formatRemaining(5 * 60 * 1000 + 30 * 1000)).toBe('05:30');
    expect(formatRemaining(0)).toBe('00:00');
  });
});
