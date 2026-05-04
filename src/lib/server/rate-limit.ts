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
 * The hit is recorded *even when blocked* — that's intentional. A flood of
 * requests should keep the window saturated and continue to be rejected; if
 * we only counted successful checks, an attacker could keep hammering once
 * the window started rolling forward.
 */
export function checkRateLimit(opts: RateLimitOptions, key: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  const k = bucketKey(opts.name, key);

  const bucket = store.get(k) ?? { hits: [] };
  // Drop expired hits first.
  while (bucket.hits.length > 0 && bucket.hits[0] < windowStart) {
    bucket.hits.shift();
  }

  bucket.hits.push(now);
  store.set(k, bucket);

  const overLimit = bucket.hits.length > opts.limit;
  const allowed = !overLimit;
  const remaining = Math.max(0, opts.limit - bucket.hits.length);
  // Time until the oldest in-window hit ages out — gives the caller a usable
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
