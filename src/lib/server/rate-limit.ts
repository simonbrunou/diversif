// Lightweight in-memory rate limiter for auth-adjacent endpoints. Backed by a
// per-key sliding window so login, signup and passkey-verify can defend against
// credential-stuffing without depending on a separate datastore. SQLite-backed
// app, single-process deploy assumed; if we ever scale horizontally this will
// need to move to a shared store.

import type { RequestEvent } from '@sveltejs/kit';

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type Bucket = {
  // Sorted list of millisecond timestamps. Trimmed on every check.
  hits: number[];
};

const store = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** Bucket name used as a prefix in the key (e.g. 'login'). */
  name: string;
  /** Maximum hits allowed within `windowMs` for a single key. */
  limit: number;
  /** Sliding window length in milliseconds. */
  windowMs: number;
};

function bucketKey(name: string, key: string): string {
  return `${name}:${key}`;
}

/**
 * Records a hit and returns whether the caller should be allowed through.
 *
 * Uses a strict sliding window: each call appends `now` and counts the number
 * of recent hits within `windowMs`. If the limit is reached, `allowed` is
 * `false` and `retryAfterSeconds` reports how long until the oldest hit
 * leaves the window.
 *
 * The hit is recorded *even when blocked* : that's intentional. A flood of
 * requests should keep the window saturated and continue to be rejected; if
 * we only counted successful checks, an attacker could keep hammering once
 * the window started rolling forward.
 *
 * Memory is bounded per bucket at `limit + 1` timestamps. Once the bucket is
 * already over the limit, additional incoming hits don't change the
 * decision (still blocked) or the retryAfter (still based on the oldest
 * in-window hit), so we drop the timestamp instead of pushing. Without this
 * cap, a single attacker hitting at 1k+ req/s for windowMs seconds would
 * grow the array to hundreds of thousands of entries and turn the trim
 * loop's repeated `shift()` calls into a quadratic CPU sink.
 */
export function checkRateLimit(opts: RateLimitOptions, key: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  const k = bucketKey(opts.name, key);

  const bucket = store.get(k) ?? { hits: [] };
  // Drop expired hits first so the cap below reflects the live window.
  while (bucket.hits.length > 0 && bucket.hits[0] < windowStart) {
    bucket.hits.shift();
  }

  // Cap memory: once we already have `limit + 1` in-window hits, the
  // decision is locked at "blocked" until enough of them age out. Recording
  // more is pointless and unbounded.
  if (bucket.hits.length <= opts.limit) {
    bucket.hits.push(now);
  }
  store.set(k, bucket);

  const overLimit = bucket.hits.length > opts.limit;
  const allowed = !overLimit;
  const remaining = Math.max(0, opts.limit - bucket.hits.length);
  // Time until the oldest in-window hit ages out : gives the caller a usable
  // Retry-After even when we just hit the cap on this very call. We always
  // push `now` above so `bucket.hits` is never empty here; the fallback is
  // defensive against future refactors and isn't reachable today.
  /* v8 ignore next */
  const oldest = bucket.hits[0] ?? now;
  const retryAfterSeconds = overLimit
    ? Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000))
    : 0;

  return { allowed, remaining, retryAfterSeconds };
}

/** Forget a specific key (e.g. on successful login, to reset the counter). */
export function resetRateLimit(name: string, key: string): void {
  store.delete(bucketKey(name, key));
}

/**
 * Evict buckets whose newest hit is older than `maxAgeMs`. Caps memory growth
 * for high-cardinality traffic : without this, every distinct client IP that
 * ever hits an auth endpoint stays in the map for the lifetime of the
 * process. Wired into the periodic cleanup task in `./cleanup.ts`. Safe to
 * call from anywhere; no I/O, just an in-memory walk.
 *
 * Returns the number of buckets removed (mostly for tests / observability).
 */
export function evictExpiredRateLimits(maxAgeMs: number, now: number = Date.now()): number {
  const cutoff = now - maxAgeMs;
  let removed = 0;
  for (const [k, bucket] of store) {
    const newest = bucket.hits[bucket.hits.length - 1];
    if (newest === undefined || newest < cutoff) {
      store.delete(k);
      removed += 1;
    }
  }
  return removed;
}

/** Test-only: wipe the entire store. */
export function _clearAllRateLimits(): void {
  store.clear();
}

/**
 * Resolves a stable client identifier for rate-limiting.
 *
 * Prefers SvelteKit's `getClientAddress()` (which respects `ADDRESS_HEADER`
 * / `XFF_DEPTH` config in adapter-node). Falls back to the `unknown` bucket
 * if the platform can't tell us. Note that behind a reverse proxy the
 * operator MUST configure ADDRESS_HEADER, otherwise every request looks
 * like it came from the proxy and one bad client locks everyone out.
 */
export function clientKey(event: RequestEvent): string {
  try {
    return event.getClientAddress() || 'unknown';
  } catch {
    return 'unknown';
  }
}
