// Lightweight in-memory rate limiter for auth-adjacent endpoints. Backed by a
// per-key sliding window so login, signup, join, and passkey-verify can
// defend against credential-stuffing without depending on a separate
// datastore. SQLite-backed app, single-process deploy assumed.
//
// Two known limitations of the in-memory-Map design, both interim until a
// shared/persisted store (Redis, or a rate_limit_hits table alongside the
// idempotency_keys/webauthn_challenges cleanup pattern) replaces it:
//   - every process restart/redeploy resets every bucket to zero — a normal
//     operational event (Coolify redeploys this app's container on every
//     push), not something an attacker can trigger on demand, but it does
//     lower the throttle's real-world effectiveness on an actively
//     redeployed instance;
//   - the store is capped at RATE_LIMIT_MAX_ENTRIES distinct keys (#303):
//     once exceeded, the least-recently-hit bucket is evicted to make room
//     for a new one. This bounds worst-case memory against a botnet
//     spreading across many source IPs/emails between the 6-hourly
//     evictExpiredRateLimits sweeps, without weakening throttling for any
//     bucket an attacker is actively still hammering: eviction always
//     targets the STALEST bucket by its own newest recorded hit, never the
//     busiest one, so a live attack can't buy itself a free reset by
//     minting enough throwaway keys to push its own hot bucket out.

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

// Interim mitigation for #303: bounds the Map's worst-case size against a
// botnet spread across many distinct IPs/emails, each individually staying
// under its own per-key ceiling so nothing here ever blocks them, minting a
// fresh bucket per key between the 6-hourly evictExpiredRateLimits sweeps.
// 10k entries comfortably covers legitimate traffic for the single-
// container deployment this module is built for (an actively-developed,
// non-hyperscale family app) while staying trivial in memory — each bucket
// is a short string key plus up to ~21 numbers (the largest limit + 1, for
// LOGIN_EMAIL_LIMIT), so 10k entries is on the order of a few MB, not a
// real constraint on a container that also runs the whole app.
const RATE_LIMIT_MAX_ENTRIES = 10_000;

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
 *
 * The store as a whole is bounded at `RATE_LIMIT_MAX_ENTRIES` distinct
 * buckets (#303). Every hit re-inserts its key at the Map's most-recently-
 * used end (`delete` then `set` — `set` alone on an existing key updates
 * the value but does NOT move it in iteration order), so once the cap is
 * exceeded, evicting the FIRST key in iteration order evicts the bucket
 * whose own newest recorded hit is oldest relative to every other bucket —
 * i.e. the stalest one, never whichever bucket an attacker is actively
 * hammering right now (that bucket is always freshly re-inserted at the
 * MRU end on every one of its hits).
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
  store.delete(k);
  store.set(k, bucket);
  if (store.size > RATE_LIMIT_MAX_ENTRIES) {
    const stalest = store.keys().next().value;
    if (stalest !== undefined) store.delete(stalest);
  }

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

/**
 * Read-only variant of `checkRateLimit`: trims the window and reports the
 * decision WITHOUT recording a hit. Pair it with `recordAttempt` when the
 * bucket must count only certain outcomes — e.g. the per-email login
 * throttle counts only FAILED authentications, so 20 successful logins
 * never spend the budget.
 *
 * A "blocked" peek result is a budget check, not by itself a verdict to act
 * on: a caller gating a sensitive action (e.g. password verification)
 * behind this bucket must still perform that action and only translate the
 * peek into a rejection if the action ALSO fails on its own merits.
 * Actioning the peek unconditionally — rejecting before the real check runs
 * — would let anyone who merely knows the bucket's key (e.g. an account's
 * email address) lock out its legitimate owner with junk requests, which
 * defeats the throttle's purpose instead of serving it (see
 * src/routes/login/+page.server.ts and issue #301).
 *
 * Semantics match the check-and-consume path: a key that has recorded
 * `limit` in-window hits is blocked, so peek+record allows exactly `limit`
 * recorded attempts per window — the same budget `checkRateLimit` grants.
 * Blocked peeks deliberately record nothing: a flood of over-limit requests
 * must not extend the lockout chosen by the recorded failures.
 */
export function peekRateLimit(opts: RateLimitOptions, key: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  const bucket = store.get(bucketKey(opts.name, key));
  if (!bucket) {
    return { allowed: true, remaining: opts.limit, retryAfterSeconds: 0 };
  }
  // Trim in place so a peek also keeps the stored bucket tidy.
  while (bucket.hits.length > 0 && bucket.hits[0] < windowStart) {
    bucket.hits.shift();
  }

  const blocked = bucket.hits.length >= opts.limit;
  const remaining = Math.max(0, opts.limit - bucket.hits.length);
  const oldest = bucket.hits[0];
  const retryAfterSeconds =
    blocked && oldest !== undefined
      ? Math.max(1, Math.ceil((oldest + opts.windowMs - now) / 1000))
      : 0;
  return { allowed: !blocked, remaining, retryAfterSeconds };
}

/**
 * Record a hit without caring about the decision — the write half of the
 * `peekRateLimit` / `recordAttempt` split. Delegates to `checkRateLimit`,
 * so the window trim and the `limit + 1` memory cap apply identically.
 */
export function recordAttempt(opts: RateLimitOptions, key: string): void {
  checkRateLimit(opts, key);
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

/** Test-only: number of distinct buckets currently held. */
export function _rateLimitStoreSize(): number {
  return store.size;
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
