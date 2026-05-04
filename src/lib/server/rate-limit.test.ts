import { afterEach, describe, expect, it, vi } from 'vitest';
import { _clearAllRateLimits, checkRateLimit, clientKey, resetRateLimit } from './rate-limit';
import type { RequestEvent } from '@sveltejs/kit';

afterEach(() => {
  _clearAllRateLimits();
  vi.useRealTimers();
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
    for (let i = 0; i < opts.limit; i++) checkRateLimit(opts, 'a');
    expect(checkRateLimit(opts, 'a').allowed).toBe(false);

    vi.setSystemTime(new Date('2024-01-01T00:01:01Z')); // > windowMs later
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
