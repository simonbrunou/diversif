# Route-loader Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two surgical edits — dedup a redundant full-table scan in the report loader, and wrap the food-log create action in a `db.transaction(...)` to fix a partial-write race.

**Architecture:** Both changes are local to single files. No new files. Two TDD-shaped tasks. Spec: `docs/superpowers/specs/2026-05-06-route-loader-perf-design.md`.

**Tech Stack:** SvelteKit 2, Drizzle ORM, better-sqlite3, Vitest.

---

## File map

| Path                                               | Status | Responsibility                                                                                                                                                                    |
| -------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/child/[id]/report/+page.server.ts`     | edit   | Drop the redundant `allergenJoinRows` query; derive the per-allergen aggregation in memory from the existing `entries` array.                                                     |
| `src/routes/child/[id]/report/page.server.test.ts` | edit   | Add a fixture-based assertion that the `allergens` output for mixed entries is byte-equal to the expected shape (same before and after the refactor).                             |
| `src/routes/child/[id]/log/+page.server.ts`        | edit   | Wrap mutations + dependent reads in `db.transaction(() => ...)()`. Use a `LogActionAbort` sentinel for the in-transaction validation failure path. Redirect happens after commit. |
| `src/routes/child/[id]/log/page.server.test.ts`    | edit   | Add a rollback test: spy on `testDb.insert` to throw on `foodEntries`, submit a custom-food form, assert no rows committed for the child.                                         |

---

## Task 1 — Report query dedup (TDD)

**Files:**

- Modify: `src/routes/child/[id]/report/+page.server.ts` — delete `allergenJoinRows` query and its loop; derive `allergenAggMap` from `entries`.
- Modify: `src/routes/child/[id]/report/page.server.test.ts` — add fixture assertion.

- [ ] **Step 1: Write the new test (it should pass on the unrefactored code)**

Open `src/routes/child/[id]/report/page.server.test.ts`. Inside the existing `describe('child/[id]/report load', () => { ... })` block, add this test (adjust the existing `seedFood`/`logEntry` helpers if they have different signatures):

```ts
it('aggregates allergens from a mixed entries fixture', async () => {
  const { u, c } = await setup();
  const oeuf = seedFood('Œuf', 'proteines', 'oeuf');
  const arachide = seedFood('Arachide', 'proteines', 'arachide');
  const carotte = seedFood('Carotte', 'legumes', null);

  // 3 oeuf entries: ras, inconfort, ras → worst=inconfort, exposures=3
  logEntry(c.id, oeuf.id, u.id, new Date('2026-04-01'), 'ras');
  logEntry(c.id, oeuf.id, u.id, new Date('2026-04-15'), 'inconfort');
  logEntry(c.id, oeuf.id, u.id, new Date('2026-05-01'), 'ras');
  // 1 arachide entry: reaction → worst=reaction, exposures=1
  logEntry(c.id, arachide.id, u.id, new Date('2026-04-20'), 'reaction');
  // 2 non-allergen entries: should NOT appear in allergens output (status=untested for them)
  logEntry(c.id, carotte.id, u.id, new Date('2026-04-10'), 'ras');
  logEntry(c.id, carotte.id, u.id, new Date('2026-04-12'), 'ras');

  const data = await load(
    makeRouteEvent({
      user: u,
      params: { id: String(c.id) },
      parent: async () => ({ child: c })
    }) as unknown as Parameters<typeof load>[0]
  );

  const oeufRow = data.allergens.find((a) => a.id === 'oeuf');
  expect(oeufRow).toMatchObject({
    status: 'introduced',
    worst: 'inconfort',
    exposures: 3,
    firstGivenAt: new Date('2026-04-01').getTime(),
    lastGivenAt: new Date('2026-05-01').getTime()
  });

  const arachideRow = data.allergens.find((a) => a.id === 'arachide');
  expect(arachideRow).toMatchObject({
    status: 'introduced',
    worst: 'reaction',
    exposures: 1
  });

  // A non-introduced allergen stays as 'untested'
  const lait = data.allergens.find((a) => a.id === 'lait');
  expect(lait).toMatchObject({ status: 'untested', worst: null, exposures: 0 });
});
```

- [ ] **Step 2: Run the new test — should already PASS**

Run:

```bash
npx vitest run src/routes/child/[id]/report/page.server.test.ts
```

Expected: ALL existing tests + the new one pass on the unrefactored code. This test pins the current behaviour so the upcoming refactor can't drift.

- [ ] **Step 3: Refactor `+page.server.ts` — drop the redundant query**

Open `src/routes/child/[id]/report/+page.server.ts`.

**Delete** lines 113-148 (the `allergenJoinRows` query + the loop that builds `allergenAggMap`). Lines correspond to:

```ts
// Per-allergen summary: introduced / worst / counts.
const allergenJoinRows = db
  .select({
    allergenType: foods.allergenType,
    reaction: foodEntries.reaction,
    givenAt: foodEntries.givenAt
  })
  .from(foodEntries)
  .innerJoin(foods, eq(foods.id, foodEntries.foodId))
  .where(and(eq(foodEntries.childId, childId), isNotNull(foods.allergenType)))
  .all();

const allergenAggMap = new Map<
  string,
  { worst: ReactionId; exposures: number; first: number; last: number }
>();
for (const r of allergenJoinRows) {
  /* v8 ignore next — query already filters allergenType IS NOT NULL */
  if (!r.allergenType) continue;
  const at =
    r.givenAt instanceof Date ? r.givenAt.getTime() : /* v8 ignore next */ Number(r.givenAt);
  const cur = allergenAggMap.get(r.allergenType);
  const reaction = r.reaction as ReactionId;
  if (!cur) {
    allergenAggMap.set(r.allergenType, {
      worst: reaction,
      exposures: 1,
      first: at,
      last: at
    });
  } else {
    cur.exposures += 1;
    cur.first = Math.min(cur.first, at);
    cur.last = Math.max(cur.last, at);
    if (reactionRank[reaction] > reactionRank[cur.worst]) cur.worst = reaction;
  }
}
```

**Replace with**:

```ts
// Per-allergen summary: introduced / worst / counts. Derived from `entries`
// in memory rather than a second SQL scan — `entries` already contains
// exactly the columns we need (allergenType, reaction, givenAt) because the
// primary query above joins on the food catalog.
const allergenAggMap = new Map<
  string,
  { worst: ReactionId; exposures: number; first: number; last: number }
>();
for (const e of entries) {
  if (e.allergenType == null) continue;
  const cur = allergenAggMap.get(e.allergenType);
  if (!cur) {
    allergenAggMap.set(e.allergenType, {
      worst: e.reaction,
      exposures: 1,
      first: e.givenAt,
      last: e.givenAt
    });
  } else {
    cur.exposures += 1;
    cur.first = Math.min(cur.first, e.givenAt);
    cur.last = Math.max(cur.last, e.givenAt);
    if (reactionRank[e.reaction] > reactionRank[cur.worst]) cur.worst = e.reaction;
  }
}
```

Also: the imports `and` and `isNotNull` from `drizzle-orm` are now unused (they were only used by the deleted query). Remove them from the import line at the top of the file. The new line should be:

```ts
import { asc, eq } from 'drizzle-orm';
```

(Down from `import { and, asc, eq, isNotNull } from 'drizzle-orm';`)

- [ ] **Step 4: Run the test suite again — should still PASS**

Run:

```bash
npx vitest run src/routes/child/[id]/report/page.server.test.ts
```

Expected: all tests pass, including the new one.

- [ ] **Step 5: Run the full coverage gate**

Run:

```bash
npm run test:coverage 2>&1 | tail -10
```

Expected: 100% on lines/branches/functions/statements globally. The reduce over `entries` filters `e.allergenType == null` — the test fixture above includes 2 non-allergen entries (carotte) which exercise the `continue` branch, so coverage should hold.

- [ ] **Step 6: Lint + typecheck**

```bash
npm run lint && npm run check
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/routes/child/[id]/report/+page.server.ts src/routes/child/[id]/report/page.server.test.ts
git commit -m "Dedup redundant allergen scan in report loader"
```

---

## Task 2 — Log action transaction with sentinel pattern (TDD)

**Files:**

- Modify: `src/routes/child/[id]/log/+page.server.ts` — wrap mutations in `db.transaction`; introduce `LogActionAbort` sentinel.
- Modify: `src/routes/child/[id]/log/page.server.test.ts` — add a rollback test.

- [ ] **Step 1: Write the failing rollback test**

Open `src/routes/child/[id]/log/page.server.test.ts`. Add this test inside the existing `describe('child/[id]/log default action', ...)` block (or wherever the action tests live; if there isn't one yet, add a new `describe` block):

```ts
it('rolls back the custom-food insert when the entry insert throws', async () => {
  const { u, c } = await setup();

  // Spy testDb.insert: throw when called with foodEntries (the action's
  // entry-insert call). The custom-food insert (called with foods) goes
  // through normally — that's the write we want to see rolled back.
  const realInsert = testDb.insert.bind(testDb);
  const insertSpy = vi.spyOn(testDb, 'insert').mockImplementation((table) => {
    if (table === foodEntries) {
      throw new Error('simulated entry insert failure');
    }
    return realInsert(table);
  });

  try {
    const formData = new FormData();
    formData.set('customFood.name', 'Plat unique de test');
    formData.set('customFood.category', 'autre');
    formData.set('givenAt', new Date().toISOString().slice(0, 16));
    formData.set('reaction', 'ras');

    const event = makeRouteEvent({
      user: u,
      params: { id: String(c.id) },
      request: new Request('http://localhost/child/' + c.id + '/log', {
        method: 'POST',
        body: formData
      })
    });

    // captureFlow swallows redirects/throws and returns a {kind, ...} record.
    // We expect the action to throw (simulated DB error), which captureFlow
    // surfaces as kind: 'throw'.
    const result = await captureFlow(() =>
      actions.default(event as unknown as Parameters<typeof actions.default>[0])
    );

    expect(result.kind).toBe('throw');
  } finally {
    insertSpy.mockRestore();
  }

  // Assert: no custom food committed for this child
  const customFoods = testDb.select().from(foods).where(eq(foods.customForChildId, c.id)).all();
  expect(customFoods).toEqual([]);

  // Assert: no entry committed for this child
  const entries = testDb.select().from(foodEntries).where(eq(foodEntries.childId, c.id)).all();
  expect(entries).toEqual([]);
});
```

(Note: if `captureFlow`'s API is different — e.g. it returns a `{kind: 'fail', status, data}` for `fail()` returns or `{kind: 'throw', error}` for unhandled throws — adjust the `result.kind` assertion accordingly. Inspect `src/test/route.ts` for the actual contract before finalizing this test.)

- [ ] **Step 2: Run the new test — should FAIL**

```bash
npx vitest run src/routes/child/[id]/log/page.server.test.ts
```

Expected: this new test fails. Without a transaction wrapper, the custom-food insert commits before the entry insert throws, and `customFoods` is `[{name: 'Plat unique de test', ...}]` rather than `[]`.

- [ ] **Step 3: Implement the transaction wrapper + sentinel in `+page.server.ts`**

Open `src/routes/child/[id]/log/+page.server.ts`. Replace the current `actions` block (lines 43-177) with:

```ts
class LogActionAbort extends Error {
  constructor(
    public readonly status: number,
    public readonly userMessage: string
  ) {
    super(userMessage);
    this.name = 'LogActionAbort';
  }
}

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    const childId = Number(params.id);
    const { user } = requireMembership(locals, childId);

    const raw = Object.fromEntries(await request.formData());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, {
        error: parsed.error.issues[0]?.message ?? /* v8 ignore next */ 'Champs invalides'
      });
    }

    const givenAtDate = new Date(parsed.data.givenAt);
    if (Number.isNaN(givenAtDate.getTime())) {
      return fail(400, { error: 'Date invalide.' });
    }

    let redirectQs: URLSearchParams;
    try {
      redirectQs = db.transaction(() => {
        let foodId = parsed.data.foodId ?? null;
        const customName = parsed.data['customFood.name']?.trim();
        const customCategoryRaw = parsed.data['customFood.category']?.trim();

        if (!foodId && customName) {
          const category = CATEGORY_IDS.includes(customCategoryRaw ?? /* v8 ignore next */ '')
            ? (customCategoryRaw as string)
            : 'autre';
          const inserted = db
            .insert(foods)
            .values({
              name: customName,
              category,
              isMajorAllergen: false,
              allergenType: null,
              suggestedAgeMonths: 0,
              notes: null,
              isCustom: true,
              customForChildId: childId
            })
            .returning({ id: foods.id })
            .get();
          foodId = inserted.id;
        }

        if (!foodId) {
          throw new LogActionAbort(400, 'Aucun aliment sélectionné.');
        }

        // Verify the food belongs to this child or is from the global catalog.
        const food = db
          .select()
          .from(foods)
          .where(
            and(
              eq(foods.id, foodId),
              or(isNull(foods.customForChildId), eq(foods.customForChildId, childId))
            )
          )
          .get();
        if (!food) {
          throw new LogActionAbort(400, 'Aliment introuvable.');
        }

        // Snapshot pre-insert state so we can detect milestones after the insert.
        // The `?? 0` fallbacks are defensive — sqlite COUNT() always returns a row.
        const priorEntryCount =
          db
            .select({ n: sql<number>`count(*)` })
            .from(foodEntries)
            .where(eq(foodEntries.childId, childId))
            .get()?.n /* v8 ignore next */ ?? 0;

        const priorCategoriesCovered =
          db
            .select({ n: sql<number>`count(distinct ${foods.category})` })
            .from(foodEntries)
            .innerJoin(foods, eq(foods.id, foodEntries.foodId))
            .where(and(eq(foodEntries.childId, childId), ne(foods.category, 'autre')))
            .get()?.n /* v8 ignore next */ ?? 0;

        const priorAllergenCount =
          food.allergenType != null
            ? (db
                .select({ n: sql<number>`count(*)` })
                .from(foodEntries)
                .innerJoin(foods, eq(foods.id, foodEntries.foodId))
                .where(
                  and(eq(foodEntries.childId, childId), eq(foods.allergenType, food.allergenType))
                )
                .get()?.n /* v8 ignore next */ ?? 0)
            : null;

        const priorAllergensIntroduced =
          db
            .select({ n: sql<number>`count(distinct ${foods.allergenType})` })
            .from(foodEntries)
            .innerJoin(foods, eq(foods.id, foodEntries.foodId))
            .where(and(eq(foodEntries.childId, childId), sql`${foods.allergenType} IS NOT NULL`))
            .get()?.n /* v8 ignore next */ ?? 0;

        db.insert(foodEntries)
          .values({
            childId,
            foodId,
            givenAt: givenAtDate,
            reaction: parsed.data.reaction,
            notes: parsed.data.notes?.trim() || null,
            loggedBy: user.id,
            createdAt: new Date()
          })
          .run();

        const categoriesNowCovered =
          db
            .select({ n: sql<number>`count(distinct ${foods.category})` })
            .from(foodEntries)
            .innerJoin(foods, eq(foods.id, foodEntries.foodId))
            .where(and(eq(foodEntries.childId, childId), ne(foods.category, 'autre')))
            .get()?.n /* v8 ignore next */ ?? 0;

        const isFirstAllergen = priorAllergenCount === 0 && food.allergenType != null;
        const allAllergensJustCompleted =
          isFirstAllergen && priorAllergensIntroduced + 1 === ALLERGENS.length;

        const search = new URLSearchParams({ logged: '1' });
        if (priorEntryCount === 0) search.set('first', '1');
        if (isFirstAllergen) search.set('allergen', food.allergenType as string);
        if (allAllergensJustCompleted) search.set('allAllergens', '1');
        search.set('categories', String(categoriesNowCovered));
        search.set('prevCategories', String(priorCategoriesCovered));
        return search;
      })();
    } catch (e) {
      if (e instanceof LogActionAbort) {
        return fail(e.status, { error: e.userMessage });
      }
      throw e;
    }

    throw redirect(303, `/child/${childId}?${redirectQs.toString()}`);
  }
};
```

Key changes from the original:

1. New `LogActionAbort` class at module scope (above the `actions` export).
2. Schema validation, date validation, and `requireMembership` stay before the transaction.
3. Everything from the optional custom-food insert through the post-insert count is inside `db.transaction(() => { ... })()`.
4. The transaction returns the `URLSearchParams` instance (assigned to `redirectQs` outside) — this is needed because the `redirect` MUST happen _outside_ the transaction (a thrown `redirect()` would be seen as an error by better-sqlite3 and roll back the transaction). The inner variable is named `search` to match the original code; the outer is `redirectQs` to avoid shadowing the route's destructured `params` argument (which the action callback receives).
5. `return fail(...)` for the in-action validation cases (`Aucun aliment sélectionné`, `Aliment introuvable`) is replaced with `throw new LogActionAbort(...)` inside the transaction; the outer `try/catch` translates it back to `fail(...)`.

- [ ] **Step 4: Run the rollback test — should now PASS**

```bash
npx vitest run src/routes/child/[id]/log/page.server.test.ts
```

Expected: all existing tests pass, plus the new rollback test.

- [ ] **Step 5: Run the full suite**

```bash
npm run test
```

Expected: 729 tests pass (or 730 with the new rollback test). No regressions.

- [ ] **Step 6: Run coverage**

```bash
npm run test:coverage 2>&1 | tail -15
```

Expected: 100% on lines/branches/functions/statements. The new code paths to verify are covered:

- The `throw new LogActionAbort(400, 'Aucun aliment sélectionné.')` branch — exercised by the existing test that submits with neither `foodId` nor `customFood.name`.
- The `throw new LogActionAbort(400, 'Aliment introuvable.')` branch — exercised by the existing test that submits a non-existent `foodId`.
- The `e instanceof LogActionAbort` branch — exercised by the two above (they throw the sentinel which is caught and translated to `fail`).
- The `throw e` re-throw branch — exercised by the new rollback test (it throws a non-sentinel `Error('simulated...')` which the `catch` re-throws).

If any branch shows uncovered, add a test for it. Do NOT add `/* v8 ignore */` comments.

- [ ] **Step 7: Lint + typecheck**

```bash
npm run lint && npm run check
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/routes/child/[id]/log/+page.server.ts src/routes/child/[id]/log/page.server.test.ts
git commit -m "Wrap food-log create action in db.transaction; rollback on failure"
```

---

## Final verification

After both tasks, run the full gate one more time:

```bash
npm run lint && npm run check && npm run test:coverage && npm run build
```

Expected: clean across the board. If anything fails, treat as a bug in the prior task and fix forward — do NOT push to main with a red gate.
