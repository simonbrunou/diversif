# Route-loader Performance — Design

**Date:** 2026-05-06
**Status:** Approved (pending implementation plan)
**Owner:** Simon Brunou

## Goal

Tighten three route-loader / form-action paths whose query patterns will degrade as a child's history grows: the child dashboard, the report page, and the food-log write action. The dashboard cap and report dedup are pure perf; the log-action transaction is also a correctness fix.

## Non-goals

- Merging COUNT/SELECT queries into CTEs to reduce query count. better-sqlite3 is synchronous and in-process; the wall-clock cost is dominated by unbounded scans, not query count. YAGNI.
- Changing read-only loader cardinality elsewhere (allergens, suggestions, analytics, layout): the Explore audit confirmed they're already bounded.
- Adding caching, request-coalescing, or N+1 detection middleware. None apply.
- Touching the form action's UX (still single-submit), rendering pipeline, or schema.

## Targets

### 1. Dashboard scan cap (`src/routes/child/[id]/+page.server.ts`)

The dashboard fetches the child's **entire** food-entry history into `recentForReminders` and feeds it to `computeReminders`. With no `WHERE` and no `LIMIT`, this scan grows linearly with the child's lifetime and runs on every dashboard render.

**Change:**

- Add `WHERE date >= <now − 60 days>` and `LIMIT 200` to the `recentForReminders` query, ordered by `date DESC`.
- Document the bound in an inline comment: "60 days covers reaction follow-up windows and the introduction rhythm we model in computeReminders; 200 is a safety ceiling for very-active loggers."

**Why those numbers:**

- 60 days comfortably exceeds the effective horizon of `computeReminders` (its rules look at recent reactions and short-window repeat candidates, not lifetime history). The implementation plan should re-confirm this against the reminders module before the cap lands.
- 200 entries protects against an unrealistically active logger (≈3-4 entries/day for two months).
- We pick the **intersection** (`AND`), so both clauses bind. The 60-day clause is the load-bearing one in steady state; the 200 LIMIT is a paranoid ceiling.

**Behaviour change:** A child whose only logged entries are older than 60 days would see "no recent activity" reminders. This matches the intent — the reminder engine is meant to nudge based on _recent_ patterns, not lifetime history.

### 2. Report query dedup (`src/routes/child/[id]/report/+page.server.ts`)

Two full-table scans run sequentially: a primary `rows` query (full join over the entry catalog) and a secondary `allergenJoinRows` that is a strict subset of `rows`. The aggregation can be derived from `rows` in memory.

**Change:**

- Delete the `allergenJoinRows` query and its call site.
- Replace with an in-memory filter+reduce over the `rows` array (filter to allergen-typed entries, group by allergen, keep min/max/count).
- The aggregated object's shape is unchanged. Existing tests must continue to pass without change.

**Behaviour:** Pure refactor, no observable change.

### 3. Log form action transaction (`src/routes/child/[id]/foods/+page.server.ts`)

The form action runs ~6 sequential mutations (insert custom food → verify food → 3 pre-insert snapshot reads → insert entry → 1 post-insert count) without a transaction wrapper. Failure mid-sequence can leave inconsistent state — most concerningly, an entry can land without the allergen-snapshot bookkeeping that the reminder engine and the milestones logic depend on.

**Change:**

- Wrap the entire mutation sequence in `db.transaction(() => { ... })`.
- Move the entry-insert and post-insert count inside the same transaction so the snapshot-vs-insert race is closed.
- Pre-insert snapshot reads stay as 3 separate queries (different tables; merging them adds complexity for no win).

**Behaviour change:** Atomic. If anything in the sequence throws, none of the writes commit. The failure-mode tests must verify this.

## Architecture

```
                    Before                              After
─────────────────────────────────────   ─────────────────────────────────────
Dashboard           +page.server.ts     Dashboard           +page.server.ts
                    └─ recentForReminders                   └─ recentForReminders
                       SELECT * FROM entries                   SELECT * FROM entries
                       WHERE child=...                         WHERE child=...
                       ORDER BY date DESC                        AND date >= now-60d
                                                               ORDER BY date DESC
                                                               LIMIT 200

Report              +page.server.ts     Report              +page.server.ts
                    ├─ rows (full join)                     └─ rows (full join)
                    └─ allergenJoinRows                        + in-memory allergen reduce
                       (full scan, redundant)

Foods action        +page.server.ts     Foods action        +page.server.ts
                    1. INSERT custom food (maybe)           db.transaction(() => {
                    2. SELECT food (verify)                   1. INSERT custom food
                    3. SELECT count A                         2. SELECT food
                    4. SELECT count B                         3. SELECT count A
                    5. SELECT count C                         4. SELECT count B
                    6. INSERT entry                           5. SELECT count C
                    7. SELECT count D (milestone)             6. INSERT entry
                                                              7. SELECT count D
                                                            })
```

## Components

| File                                               | Status | Responsibility                                                   |
| -------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| `src/routes/child/[id]/+page.server.ts`            | edit   | Cap `recentForReminders` (date + LIMIT).                         |
| `src/routes/child/[id]/report/+page.server.ts`     | edit   | Drop `allergenJoinRows`; derive in memory.                       |
| `src/routes/child/[id]/foods/+page.server.ts`      | edit   | Wrap action's 6+ queries in `db.transaction(...)`.               |
| `src/routes/child/[id]/page.server.test.ts`        | edit   | Add scan-cap tests (60-day window + 200-row LIMIT).              |
| `src/routes/child/[id]/report/page.server.test.ts` | edit   | Add an assertion that the allergen aggregate shape is preserved. |
| `src/routes/child/[id]/foods/page.server.test.ts`  | edit   | Add a fail-mid-sequence test asserting no partial commit.        |

No new files. All changes are surgical edits.

## Data flow / failure modes

- **Dashboard cap:** A child with no entries in the last 60 days produces an empty `recentForReminders` array. `computeReminders` already handles empty input (existing behaviour for new children); no extra guard needed.
- **Report dedup:** If `rows` is empty, the in-memory reduce returns an empty aggregate (same shape as today's empty SQL result).
- **Log action transaction:** better-sqlite3's `db.transaction(fn)` returns a wrapped callable. We invoke it; if any query inside throws, the transaction rolls back automatically. The form action's existing `try/catch` around the sequence must be preserved (it returns a typed error to the client) — the transaction wrapper goes _inside_ the try block.

## Testing

| File                                               | New assertion                                                                                                                                                                                                                             |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/child/[id]/page.server.test.ts`        | Seed 250 entries spanning 90 days. Load page. Assert: the entries fed to `computeReminders` are all dated within 60 days AND `length ≤ 200`. (Mock `computeReminders` to capture its first arg, or assert via the SQL result indirectly.) |
| `src/routes/child/[id]/report/page.server.test.ts` | Seed mixed allergen + non-allergen entries. Load page. Assert the aggregated allergen object is byte-equal (after JSON serialization) to a fixture computed from the seeded entries.                                                      |
| `src/routes/child/[id]/foods/page.server.test.ts`  | Spy on the entry-insert query and force it to throw mid-action. Assert: no entry row exists for the child after the failure (transaction rollback). The 100% coverage gate must still hold.                                               |

The codebase has a 100%-coverage CI gate. Any new branch in the implementation must be exercised by a test.

## Out of scope (followups)

- N+1 detection middleware or query budget per request.
- Background prefetch / streaming.
- Pagination of the report's full-history scan (independent perf concern; report is rarely accessed).
- Replacing the 3 pre-insert snapshot reads with a single derived query.
