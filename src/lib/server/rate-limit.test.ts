import { afterEach, describe, expect, it, setSystemTime } from 'bun:test';
import {
  _clearAllRateLimits,
  _rateLimitStoreSize,
  checkRateLimit,
  clientKey,
  evictExpiredRateLimits,
  peekRateLimit,
  recordAttempt,
  resetRateLimit
} from './rate-limit';
import type { RequestEvent } from '@sveltejs/kit';

afterEach(() => {
  _clearAllRateLimits();
  setSystemTime(null);
});

describe('checkRateLimit', () => {
  const opts = { name: 'test', limit: 3, windowMs: 60_000 };

  it('allows hits up to the limit', () => {
    expect(checkRateLimit(opts, 'a').allowed).toBe(true);
    expect(checkRateLimit(opts, 'a').allowed).toBe(true);
    expect(checkRateLimit(opts, 'a').allowed).toBe(true);
  });

  it('blocks once the limit is exceeded', () => {
    for (let i = 0; i < opts.limit; i++) checkRateLimit(opts, 'a');
    const result = checkRateLimit(opts, 'a');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keeps blocking under sustained load', () => {
    for (let i = 0; i < opts.limit + 5; i++) checkRateLimit(opts, 'a');
    expect(checkRateLimit(opts, 'a').allowed).toBe(false);
  });

  it('isolates buckets by key', () => {
    for (let i = 0; i < opts.limit; i++) checkRateLimit(opts, 'a');
    expect(checkRateLimit(opts, 'a').allowed).toBe(false);
    expect(checkRateLimit(opts, 'b').allowed).toBe(true);
  });

  it('isolates buckets by name', () => {
    for (let i = 0; i < opts.limit; i++) checkRateLimit(opts, 'a');
    expect(checkRateLimit({ ...opts, name: 'other' }, 'a').allowed).toBe(true);
  });

  it('lets hits age out after the window', () => {
    setSystemTime(new Date()); /* [bun-test] was useFakeTimers() */
    setSystemTime(new Date('2024-01-01T00:00:00Z'));
    for (let i = 0; i < opts.limit; i++) checkRateLimit(opts, 'a');
    expect(checkRateLimit(opts, 'a').allowed).toBe(false);

    setSystemTime(new Date('2024-01-01T00:01:01Z')); // > windowMs later
    expect(checkRateLimit(opts, 'a').allowed).toBe(true);
  });

  it('reports remaining = limit - hits', () => {
    expect(checkRateLimit(opts, 'a').remaining).toBe(2);
    expect(checkRateLimit(opts, 'a').remaining).toBe(1);
    expect(checkRateLimit(opts, 'a').remaining).toBe(0);
  });

  it('resetRateLimit clears a specific bucket', () => {
    for (let i = 0; i < opts.limit; i++) checkRateLimit(opts, 'a');
    expect(checkRateLimit(opts, 'a').allowed).toBe(false);
    resetRateLimit(opts.name, 'a');
    expect(checkRateLimit(opts, 'a').allowed).toBe(true);
  });

  // Regression for #303 (F-S4): the store must not grow without bound
  // between the 6-hourly evictExpiredRateLimits sweeps.
  it('caps the store at RATE_LIMIT_MAX_ENTRIES distinct buckets', () => {
    const capOpts = { name: 'capacity', limit: 1000, windowMs: 60_000 };
    for (let i = 0; i < 10_000; i++) {
      checkRateLimit(capOpts, `key-${i}`);
    }
    expect(_rateLimitStoreSize()).toBe(10_000);
    // One more distinct key exceeds the cap : still capped, not 10_001.
    checkRateLimit(capOpts, 'key-10000');
    expect(_rateLimitStoreSize()).toBe(10_000);
  });

  // The property that actually matters (per review): eviction must target
  // whichever bucket was hit LEAST recently, never whichever bucket merely
  // happens to be the busiest / most recently hit — otherwise an attacker
  // could mint enough throwaway keys to evict their own hot bucket and get
  // a free reset. A naive FIFO/insertion-order cap would fail this test.
  it('evicts the least-recently-hit bucket when the cap is exceeded, never a bucket that was just re-hit', () => {
    const lruOpts = { name: 'lru', limit: 1000, windowMs: 60_000 };
    // 'first' and 'second' are inserted before any filler key — under a
    // naive insertion-order cap, 'first' would be the very first evicted.
    checkRateLimit(lruOpts, 'first');
    checkRateLimit(lruOpts, 'second');
    for (let i = 0; i < 9_998; i++) {
      checkRateLimit(lruOpts, `filler-${i}`);
    }
    expect(_rateLimitStoreSize()).toBe(10_000);

    // Re-hit 'first' : a real attacker actively hammering this bucket right
    // now. It must become the most-recently-used entry, not stay the
    // stalest one just because it was created first.
    checkRateLimit(lruOpts, 'first');

    // One more distinct key exceeds the cap by one.
    checkRateLimit(lruOpts, 'one-more');

    expect(_rateLimitStoreSize()).toBe(10_000);
    // 'first' survived with its accumulated hits intact — not silently
    // reset to a fresh bucket, and its live throttle wasn't weakened.
    expect(peekRateLimit(lruOpts, 'first').remaining).toBe(lruOpts.limit - 2);
    // 'second' — untouched since its single initial hit — was the actual
    // stalest bucket and is the one evicted; peeking it now looks fresh.
    expect(peekRateLimit(lruOpts, 'second').remaining).toBe(lruOpts.limit);
  });
});

describe('peekRateLimit / recordAttempt', () => {
  const opts = { name: 'peek', limit: 3, windowMs: 60_000 };

  it('peek never consumes: repeated peeks leave the bucket untouched', () => {
    for (let i = 0; i < 100; i++) {
      const r = peekRateLimit(opts, 'a');
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(opts.limit);
      expect(r.retryAfterSeconds).toBe(0);
    }
  });

  it('recordAttempt consumes; peek reflects the recorded hits', () => {
    recordAttempt(opts, 'a');
    expect(peekRateLimit(opts, 'a').remaining).toBe(2);
    recordAttempt(opts, 'a');
    expect(peekRateLimit(opts, 'a').remaining).toBe(1);
  });

  it('peek blocks after `limit` recorded attempts — same budget as checkRateLimit', () => {
    for (let i = 0; i < opts.limit; i++) {
      expect(peekRateLimit(opts, 'a').allowed).toBe(true);
      recordAttempt(opts, 'a');
    }
    const blocked = peekRateLimit(opts, 'a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('blocked peeks do not extend the lockout window', () => {
    setSystemTime(new Date('2024-01-01T00:00:00Z'));
    for (let i = 0; i < opts.limit; i++) recordAttempt(opts, 'a');
    // A flood of peeks while blocked must not push the window forward.
    setSystemTime(new Date('2024-01-01T00:00:30Z'));
    for (let i = 0; i < 50; i++) expect(peekRateLimit(opts, 'a').allowed).toBe(false);
    // The original hits age out on schedule despite the peek flood.
    setSystemTime(new Date('2024-01-01T00:01:01Z'));
    expect(peekRateLimit(opts, 'a').allowed).toBe(true);
  });

  it('recorded hits age out after the window', () => {
    setSystemTime(new Date('2024-01-01T00:00:00Z'));
    for (let i = 0; i < opts.limit; i++) recordAttempt(opts, 'a');
    expect(peekRateLimit(opts, 'a').allowed).toBe(false);
    setSystemTime(new Date('2024-01-01T00:01:01Z'));
    expect(peekRateLimit(opts, 'a').allowed).toBe(true);
    expect(peekRateLimit(opts, 'a').remaining).toBe(opts.limit);
  });

  it('peek and check share the same bucket', () => {
    for (let i = 0; i < opts.limit; i++) checkRateLimit(opts, 'a');
    expect(peekRateLimit(opts, 'a').allowed).toBe(false);
  });
});

describe('evictExpiredRateLimits', () => {
  it('drops buckets whose newest hit is older than maxAge', () => {
    setSystemTime(new Date()); /* [bun-test] was useFakeTimers() */
    setSystemTime(new Date('2024-01-01T00:00:00Z'));
    const opts = { name: 'evict', limit: 10, windowMs: 60_000 };
    checkRateLimit(opts, 'a');
    checkRateLimit(opts, 'b');

    // Move past the eviction horizon for `a` only.
    setSystemTime(new Date('2024-01-01T02:00:00Z'));
    checkRateLimit(opts, 'b');

    const removed = evictExpiredRateLimits(60 * 60 * 1000);
    expect(removed).toBe(1);
    // 'a' has a clean slate (10-1=9); 'b' carries 1 fresh hit (window trimmed
    // the original 00:00 entry on the second call), plus the new one = 2.
    expect(checkRateLimit(opts, 'a').remaining).toBe(9);
    expect(checkRateLimit(opts, 'b').remaining).toBe(8);
  });

  it('returns 0 when no buckets are stale', () => {
    const opts = { name: 'evict', limit: 10, windowMs: 60_000 };
    checkRateLimit(opts, 'a');
    expect(evictExpiredRateLimits(60 * 60 * 1000)).toBe(0);
  });
});

describe('clientKey', () => {
  it('uses event.getClientAddress when available', () => {
    const event = {
      getClientAddress: () => '203.0.113.5'
    } as unknown as RequestEvent;
    expect(clientKey(event)).toBe('203.0.113.5');
  });

  it('falls back to "unknown" when getClientAddress throws', () => {
    const event = {
      getClientAddress: () => {
        throw new Error('not available');
      }
    } as unknown as RequestEvent;
    expect(clientKey(event)).toBe('unknown');
  });

  it('falls back when getClientAddress returns empty', () => {
    const event = {
      getClientAddress: () => ''
    } as unknown as RequestEvent;
    expect(clientKey(event)).toBe('unknown');
  });
});
