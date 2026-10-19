import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { isE2E } from './e2e';
import { users, memberships, type User } from './db/schema';

// Bun.password ships argon2id natively. memoryCost/timeCost mirror the
// previous @node-rs/argon2 tuning so the cost profile is unchanged and
// existing $argon2id$ hashes from before the migration verify-roundtrip
// (the format is standard, not implementation-specific).
const ARGON_OPTS = {
  algorithm: 'argon2id',
  memoryCost: 19_456,
  timeCost: 2
} as const;

// E2E runs the production build with full-cost argon2id. Under two parallel
// Playwright workers the CPU cost starves the single server process and stalls
// unrelated requests (the fast child-creation redirect queues past its 15s
// budget). Relax the cost for E2E only (isE2E() requires both E2E=1 — set in
// playwright.config.ts — and a loopback http build origin, so a stray E2E=1 on a
// real deployment can't weaken production hashes) — hash strength is
// irrelevant against a throwaway test DB, and Bun.password.verify reads each
// hash's params back from the stored string, so verification is unaffected.
const ARGON_OPTS_E2E = { algorithm: 'argon2id', memoryCost: 4_096, timeCost: 1 } as const;

export async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, isE2E() ? ARGON_OPTS_E2E : ARGON_OPTS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    // Bun.password.verify takes (password, hash) — OPPOSITE of
    // @node-rs/argon2's (hash, password). Flipped intentionally.
    return await Bun.password.verify(plain, hash);
  } catch {
    return false;
  }
}

// Decoy hash. Built lazily so importing the module is cheap (skipping argon
// during the import keeps the test suite fast), and warmed at module load in
// non-test runs so the FIRST production "no such user" attempt isn't ~2x
// slower than the steady state -- which would itself be a timing oracle.
// A single hash is reused for the lifetime of the process.
let decoyHashPromise: Promise<string> | null = null;
function getDecoyHash(): Promise<string> {
  if (!decoyHashPromise) {
    decoyHashPromise = hashPassword(`argon-decoy-${randomBytes(16).toString('hex')}`);
  }
  return decoyHashPromise;
}
/* v8 ignore next 3 : module-load warming, skipped in tests by design */
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  void getDecoyHash();
}

/**
 * Verify a password against a hash, or against a decoy hash if no real hash
 * is available. The decoy path makes the wall-clock time of "user does not
 * exist" indistinguishable from "user exists, password wrong" -- defeating
 * the timing oracle that would otherwise let an unauthenticated visitor probe
 * which emails are registered.
 */
export async function verifyPasswordOrDecoy(
  hash: string | null | undefined,
  plain: string
): Promise<boolean> {
  if (hash == null) {
    await verifyPassword(await getDecoyHash(), plain);
    return false;
  }
  return verifyPassword(hash, plain);
}

export async function listMembershipsForUser(userId: number) {
  // Ordered so kids[0] (the nav fallback target on /account) is stable —
  // without ORDER BY, SQLite row order is unspecified. createdAt first so an
  // invite-joiner's own first child stays ahead of an older co-parented child
  // (childId alone would sort by global creation order across all users);
  // childId breaks same-millisecond ties deterministically.
  return db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .orderBy(memberships.createdAt, memberships.childId);
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return rows[0];
}

export { generateInviteCodeRaw, isValidInviteCodeFormat } from '#lib/utils/invites.js';
export { PASSWORD_MIN_LENGTH } from '#lib/utils/password.js';
