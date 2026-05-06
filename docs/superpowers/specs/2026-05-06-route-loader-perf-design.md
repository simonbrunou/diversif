# Route-loader Hardening — Design

**Date:** 2026-05-06
**Status:** Approved (pending implementation plan)
**Owner:** Simon Brunou

## Goal

Tighten two route-loader / form-action paths: dedup a redundant full-table scan in the report loader, and wrap the food-log create action in a transaction so partial writes can't land. The dedup is pure perf; the transaction is also a correctness fix.

## Scope changes from initial brainstorm

Initial scope included a third target — capping the dashboard's `recentForReminders` query to last-60-days + `LIMIT 200`. Reading the actual code surfaced the reminders module's type signature:

```ts
entries: EnrichedEntry[]; // full history, recent first — first-intro and exposure-count rules need it
```

The reminder rules `first-introduction`, `repeat-exposure`, and `stale-diversity` require the full per-child history. Capping silently breaks them. At realistic sizes (≤1500 entries over 2 years), the unbounded scan is sub-millisecond on better-sqlite3, so the original concern is theoretical. Target dropped.

## Non-goals

- Capping the dashboard `recentForReminders` query (see scope changes).
- Merging COUNT/SELECT queries elsewhere into CTEs to reduce query count. better-sqlite3 is synchronous and in-process; query count is not the bottleneck.
- Caching or request coalescing.
- Touching the form action's UX (still single-submit), rendering pipeline, or schema.
- Indexing changes (separate concern; would warrant its own spec).

## Targets

### 1. Report query dedup (`src/routes/child/[id]/report/+page.server.ts`)

Two full-table scans run sequentially: a primary `rows` query (full join over the entry catalog, lines 47-61) and a secondary `allergenJoinRows` (lines 113-122) that is a strict subset of `rows`. The aggregation can be derived from `rows` in memory.

**Change:**

- Delete the `allergenJoinRows` query and its call site (lines 113-122).
- Replace with an in-memory filter+reduce over the existing `entries` array (which is already mapped from `rows`): filter to entries where `allergenType != null`, group by `allergenType`, keep `worst` reaction (by reactionRank), `exposures` count, `first` and `last` timestamps.
- The aggregated `allergenAggMap` shape is unchanged. Existing tests must continue to pass without change.

**Behaviour:** Pure refactor, no observable change.

### 2. Log form action transaction (`src/routes/child/[id]/log/+page.server.ts`)

The action runs ~6 sequential mutations: optional `INSERT` of a custom food (lines 64-78), `SELECT` to verify food (lines 86-95), three pre-insert snapshot reads (`priorEntryCount`, `priorCategoriesCovered`, `priorAllergenCount`, `priorAllergensIntroduced`, lines 107-142), `INSERT` of the entry (lines 144-154), and a post-insert distinct-categories count (lines 156-162). All without a transaction. Failure mid-sequence can leave inconsistent state — most concerningly, an entry can land while the redirect URL's milestone params are computed off stale snapshots, or (worse) a custom food can be persisted without a successful entry insert that would have referenced it.

**Change:**

- Wrap everything from the optional custom-food insert through the post-insert count in `db.transaction(() => { ... })()` (better-sqlite3's `db.transaction(fn)` returns a wrapped callable; we invoke it).
- `requireMembership`, schema parse, and the date-validity check stay _outside_ the transaction — they're synchronous side-effect-free guards that should fail fast with `fail(400, ...)` before any mutation.
- The food-verify `SELECT` cannot move outside (see Architecture), so it lives inside the transaction. Validation failures inside the transaction throw a `LogActionAbort` sentinel; the outer `try/catch` translates it back to `fail(400, ...)`. Throw → automatic rollback in better-sqlite3.

**Behaviour change:** Atomic. If anything in the mutation sequence throws, no writes commit. The custom-food insert can no longer leak when downstream queries fail.

## Architecture

```
                    Before                              After
─────────────────────────────────────   ─────────────────────────────────────
Report              +page.server.ts     Report              +page.server.ts
                    ├─ rows (full join)                     └─ rows (full join)
                    └─ allergenJoinRows                        + in-memory allergen reduce
                       (full scan, redundant)                    over entries[]

Log action          +page.server.ts     Log action          +page.server.ts
                    1. parse + validate                     1. parse + validate
                    2. INSERT custom food (maybe)           2. SELECT food (verify)
                    3. SELECT food (verify)                 3. db.transaction(() => {
                    4. SELECT priorEntryCount                    INSERT custom food (maybe)
                    5. SELECT priorCategories                    SELECT priorEntryCount
                    6. SELECT priorAllergen                      SELECT priorCategories
                    7. SELECT priorAllergensIntro                SELECT priorAllergen
                    8. INSERT entry                              SELECT priorAllergensIntro
                    9. SELECT categoriesNow                      INSERT entry
                                                                 SELECT categoriesNow
                                                              })()
                                                            4. redirect
```

Why the food-verify SELECT moves inside the transaction: the original control flow is "if `foodId` is provided, skip the custom-food insert; otherwise insert and use the returned id." So the verify-food guard cannot run before the custom-food insert in the custom-food path. Both must live inside the transaction; if verification fails, throw a sentinel error to roll back, then translate to `fail(400, ...)` outside the transaction. The redirect happens after the transaction commits.

## Components

| File                                               | Status | Responsibility                                                                                                                                  |
| -------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/child/[id]/report/+page.server.ts`     | edit   | Drop `allergenJoinRows`; derive in memory from `entries`.                                                                                       |
| `src/routes/child/[id]/log/+page.server.ts`        | edit   | Wrap mutations + dependent reads in `db.transaction(() => ...)()`. Use a sentinel-throw pattern for the in-transaction validation failure path. |
| `src/routes/child/[id]/report/page.server.test.ts` | edit   | Add an assertion that the `allergens` array byte-equals the previous output for a fixture with mixed allergen + non-allergen entries.           |
| `src/routes/child/[id]/log/page.server.test.ts`    | edit   | Add a test that forces the `INSERT entry` query to fail mid-sequence and asserts no rows committed for the child (transaction rollback).        |

No new files. Two surgical edits.

## Data flow / failure modes

- **Report dedup:** If `entries` is empty, the in-memory reduce returns an empty `allergenAggMap` (same shape as today's empty SQL result).
- **Log action transaction:**
  - Schema validation failure → `fail(400, ...)` _before_ the transaction. No DB activity. ✅
  - Verify-food failure (food not in catalog or not for this child) → throw a `LogActionAbort` sentinel inside the transaction → caught outside → `fail(400, 'Aliment introuvable.')`. Custom-food insert (if it happened in the same transaction) is rolled back. ✅
  - Date parse failure → still inside the transaction in the new layout; throw the sentinel, roll back. ✅
  - Entry insert fails (e.g. FK violation) → exception bubbles up through `db.transaction(fn)`, which rolls back automatically. The custom-food insert from earlier in the same transaction is rolled back. ✅
  - Post-insert count fails → exception rolls back. The entry isn't written. ✅
- **Sentinel pattern:** define `class LogActionAbort extends Error { constructor(public readonly status: number, public readonly userMessage: string) { super(userMessage); } }` at module scope. Throw inside the transaction; catch outside; convert to `fail(status, { error: userMessage })`. Never leaks to the user.

## Testing

| File                                               | New assertion                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/routes/child/[id]/report/page.server.test.ts` | Seed mixed allergen + non-allergen entries (e.g. 3 allergen entries across 2 distinct allergens with varying reactions, 2 non-allergen entries). Load page. Assert: the returned `allergens` array (after filtering to the introduced ones) equals a fixture with the expected `worst`, `exposures`, `firstGivenAt`, `lastGivenAt`. (The test asserts the _output_ shape, not the internal aggregation method, so it'll pass before AND after the refactor.) |
| `src/routes/child/[id]/log/page.server.test.ts`    | Use `vi.spyOn(db, 'insert')` (or whatever lower-level helper better-sqlite3 exposes) to force the entry-insert to throw the second time it's called (first call = custom-food insert, second = entry insert). Submit the action. Assert: the action returns a `fail(500, ...)`-shaped error, AND no `food_entries` row exists for the child, AND no orphan custom `foods` row exists.                                                                        |

The codebase has a 100%-coverage CI gate. Any new branch in the implementation must be exercised by a test — including the sentinel-catch path.

## Out of scope (followups)

- Add a composite index on `food_entries(child_id, given_at DESC)` to back-stop the dashboard scan if datasets ever grow beyond expectations.
- Pagination of the report's full-history scan (independent perf concern; report is rarely accessed).
- Replacing the 4 pre-insert snapshot reads with a single derived query.
- Capping the dashboard `recentForReminders` query (would require restructuring the reminders module to be window-aware).
