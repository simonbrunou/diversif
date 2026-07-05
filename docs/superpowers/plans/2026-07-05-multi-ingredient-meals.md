# Multi-ingredient Meals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user log several ingredients of one prepared meal in a single submission, shown/edited/deleted as one grouped meal card, without disturbing per-food diversification/allergen tracking.

**Architecture:** A nullable `mealId` group token on `food_entries` (no new table). Each ingredient stays a real row, so all per-food queries are untouched. Reaction is per-ingredient (symptom promotion mutates one row); a meal shares `givenAt`/`texture`/`notes`. Meals render as grouped cards on the dashboard recent feed and co-parent feed; the clinical report stays granular.

**Tech Stack:** SvelteKit (adapter-node under Bun), `bun:sqlite` + Drizzle, `bun:test` (in-process `:memory:`), Svelte 5 runes, Paraglide i18n.

Design spec: `docs/superpowers/specs/2026-07-05-multi-ingredient-meals-design.md` (read it — this plan implements it).

Council review: 2 rounds (implementation/testability + architect/correctness, code-level) — unanimous SOUND TO EXECUTE. Round 1 caught a required-field RED-gate spanning tasks (D1), an undefined `customName` ref (D2), `priorTypes` computed post-insert (D3), a fragment `work()` body (D4), a mandatory audit-type edit (D5), an empty dirty-only test (D6), a `removeIngredient` 404, and missing texture validation. All fixed inline (incl. deleting a now-dead `initialFoodId` that would fail lint-staged). No correctness or ordering defect remains.

## Global Constraints

- **Runtime & commands (BINDING — these override any `bun test`/`svelte-check` command written in a task below):**
  - Tests: **`bun run test`** (NOT bare `bun test` — that loads ~403 pre-existing component tests without `--conditions=browser` and they fail). Focused run: `bun run test <path>`. Coverage: `bun run test:coverage`. The repo's `test` script wraps `scripts/bun-test.ts` (paraglide + kit sync + coverage gate).
  - Typecheck: **`bun run check`** (NOT bare `svelte-check` — the script runs paraglide + kit sync first).
  - i18n keys: add via the `i18n-add-key` skill to `messages/fr.json` + `messages/en.json`; verify with `bun run lint:i18n` (note: it checks apostrophes + unused keys, NOT FR/EN parity — parity is verified by eye).
  - Migrations / Node-shebang tools: `bun --bun` (e.g. `bun run db:generate`).
  - `.svelte` edits: validate with the Svelte MCP `svelte-autofixer` before committing.
  - **Do NOT run `graphify update .`** in a task — the controller runs it once at the end (keeps per-task review diffs clean).
- **French UI, no anglicisms.** Every new user-facing string goes in BOTH `messages/fr.json` and `messages/en.json` (FR is the source of truth). Use the `i18n-add-key` skill. "repas" not "meal", "ingrédient" not "ingredient", "nouveaux aliments" for never-tried.
- **Pre-commit:** husky runs lint-staged (prettier + eslint). Do NOT bypass with `--no-verify`.
- **Reaction is per-ingredient.** Never write `reaction` across a meal's rows with one shared value (symptom promotion mutates one row — a shared write erases a recorded allergy signal). This is the load-bearing safety rule.
- **`mealId != null` ⇔ member of a multi-ingredient meal.** A meal always has ≥2 members. Created only when >1 food resolves; when a meal shrinks to 1 member, the survivor's `mealId` is nulled.
- **graphify:** the controller runs `graphify update .` ONCE at branch end (not per task) — see the commands block above.

---

## File Structure

**New files**

- `src/lib/utils/meals.ts` — pure `groupByMeal()` helper + `MealGroup` type.
- `src/lib/utils/meals.test.ts` — its unit tests.

**Modified — data & server**

- `src/lib/server/db/schema.ts` — `mealId` column + index + partial unique index.
- `drizzle/00NN_*.sql` — generated migration (do not hand-write).
- `src/routes/child/[id]/log/+page.server.ts` — batch parse/insert, `mealId`, milestone rewrite, `introducedFoodIds` in load.
- `src/routes/child/[id]/log/[entryId]/+page.server.ts` — meal-mode detection + `update` (shared + dirty per-ingredient reaction), `deleteMeal`, `removeIngredient`.
- `src/routes/child/[id]/+page.server.ts` — project `mealId`, `asc(id)` secondary sort in `recent`.
- `src/lib/server/guidance/queries/timeline.ts` — project `mealId`, `asc(id)` in `loadCoparentActivity`; `CoparentEntry` gains `mealId`.
- `src/routes/child/[id]/report/+page.server.ts` — project `mealId`, annotate `notable` (no grouping).
- `src/lib/server/gdpr.ts` — include `mealId` in export projection.
- `src/lib/offline/queue.ts` — `formData: Record<string, string | string[]>` + array-aware replay.
- `src/lib/types.ts` — `mealId` on `RecentEntry`.
- `src/test/route.ts` — `formData: Record<string, string | string[]>`.

**Modified — UI**

- `src/lib/components/FoodCombobox.svelte` — `multiple` prop.
- `src/routes/child/[id]/log/+page.svelte` — multi-select, never-tried hint, offline capture fix.
- `src/routes/child/[id]/log/[entryId]/+page.svelte` — meal-mode form.
- `src/lib/components/bento/RecentFeed.svelte` — render grouped meal cards.
- `src/lib/components/CoparentsSection.svelte` — render grouped co-parent meals.
- `src/routes/child/[id]/report/+page.svelte` — "dans un repas" annotation.
- `messages/fr.json`, `messages/en.json` — new keys.

---

## Shared test helpers

Several tasks reference setup helpers that don't exist yet. They are trivial to write following the existing inline `setup()` in `log.create.test.ts` (seed user → child → membership → catalog food ids). Write them once in the relevant test file. The only non-obvious one — because it inserts a real multi-row shared-`mealId` group — is `seedMeal`:

```ts
// Insert a meal of N ingredients sharing one mealId; returns the ids in order.
async function seedMeal(reactions: ('ras' | 'inconfort' | 'reaction')[]) {
  const user = await seedUser();
  const child = await seedChild({ createdBy: user.id });
  await seedMembership({ userId: user.id, childId: child.id });
  const foods = await testDb.select().from(schema.foods).limit(reactions.length);
  const m1 = 'meal-' + child.id;
  const ids: number[] = [];
  for (let i = 0; i < reactions.length; i++) {
    const row = (
      await testDb
        .insert(schema.foodEntries)
        .values({
          childId: child.id,
          foodId: foods[i].id,
          givenAt: new Date(),
          reaction: reactions[i],
          createdAt: new Date(),
          updatedAt: new Date(),
          mealId: m1
        })
        .returning({ id: schema.foodEntries.id })
    )[0];
    ids.push(row.id);
  }
  return {
    user,
    child,
    m1,
    ids,
    memberships: [
      /* build via seedMembership+safeUser as other tests do */
    ]
  };
}
```

The others — `setupThreeFoods` (seed user/child + 3 catalog food ids), `seedTenAllergensIntroduced` (log 10 distinct-allergen foods), `twoNewAllergenFoodIds` (pick 2 catalog foods with fresh allergen types), `logOneFood` (insert one `food_entries` row) — follow the same pattern. Where a snippet uses bare `user`/`memberships`, bind them from the helper's return (as `log.create.test.ts` already does).

---

## Task 1: Schema — `mealId` column, index, partial unique index

**Files:**

- Modify: `src/lib/server/db/schema.ts` (the `foodEntries` table, ~144-177)
- Create: generated `drizzle/00NN_*.sql`
- Test: `src/lib/server/db/schema.test.ts`

**Interfaces:**

- Produces: `foodEntries.mealId` (`text('meal_id')`, nullable). New indexes `food_entries_meal_idx` and partial-unique `food_entries_meal_food_uq`.

- [ ] **Step 1: Write the failing test** — append to `src/lib/server/db/schema.test.ts`:

```ts
import { sql } from 'drizzle-orm';

test('food_entries accepts a mealId group token and rejects duplicate (mealId, foodId)', async () => {
  const user = await seedUser();
  const child = await seedChild({ createdBy: user.id });
  // a catalog food id — seedFoods runs in the test harness; pick id 1
  const foodId = (await testDb.select().from(schema.foods).limit(1))[0].id;

  const base = {
    childId: child.id,
    foodId,
    givenAt: new Date(),
    reaction: 'ras' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    mealId: 'meal-abc'
  };
  await testDb.insert(schema.foodEntries).values(base);

  // same (mealId, foodId) must violate the partial unique index
  await expect(testDb.insert(schema.foodEntries).values(base)).rejects.toThrow();

  // a standalone row (mealId null) with the same foodId is fine (repeat logging)
  await testDb.insert(schema.foodEntries).values({ ...base, mealId: null });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `bun test src/lib/server/db/schema.test.ts` → fails (`mealId` unknown column).

- [ ] **Step 3: Add the column + indexes** in `schema.ts`. Add the field to `foodEntries` columns (after `updatedAt`):

```ts
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
    // Group token for multi-ingredient meals: NULL = standalone entry; a shared
    // UUID = ingredients logged together. Not an FK — reaction/texture/notes
    // stay on the row (reaction is per-ingredient; symptom promotion mutates one
    // row). See docs/superpowers/specs/2026-07-05-multi-ingredient-meals-design.md
    mealId: text('meal_id')
```

And in the table's index builder (the `(t) => ({ ... })` block), add:

```ts
    mealIdx: index('food_entries_meal_idx').on(t.mealId),
    // A meal never contains the same food twice. Partial so standalone rows
    // (mealId NULL) can still repeat a food across days.
    mealFoodUnique: uniqueIndex('food_entries_meal_food_uq')
      .on(t.mealId, t.foodId)
      .where(sql`${t.mealId} is not null`),
```

(`index`, `uniqueIndex`, `sql` are already imported.)

- [ ] **Step 4: Generate the migration** — `bun run db:generate`. Confirm a new `drizzle/00NN_*.sql` adds `meal_id` and the two indexes. Do not hand-edit it.

- [ ] **Step 5: Run tests, expect PASS** — `bun test src/lib/server/db/schema.test.ts` → PASS. Also `bun --bun svelte-check` clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/db/schema.ts src/lib/server/db/schema.test.ts drizzle/
git commit -m "feat(db): add nullable mealId group token to food_entries"
```

---

## Task 2: Test helper — array-valued form fields

**Files:**

- Modify: `src/test/route.ts:31` (type) and `:41-42` (append loop)
- Test: `src/test/route.test.ts` (create if absent)

**Interfaces:**

- Produces: `RouteEventOptions.formData?: Record<string, string | string[]>`; `makeRouteEvent` appends one value per array element so `request.formData().getAll(key)` returns all.

- [ ] **Step 1: Write the failing test** — `src/test/route.test.ts`:

```ts
import { test, expect } from 'bun:test';
import { makeRouteEvent } from './route';

test('makeRouteEvent expands array form values into repeated keys', async () => {
  const ev = makeRouteEvent({ formData: { foodId: ['1', '2', '3'], givenAt: 'x' } });
  const fd = await ev.request.formData();
  expect(fd.getAll('foodId')).toEqual(['1', '2', '3']);
  expect(fd.get('givenAt')).toBe('x');
});
```

- [ ] **Step 2: Run it, expect FAIL** — `bun test src/test/route.test.ts` (only the last-appended `foodId` survives today).

- [ ] **Step 3: Implement** — in `src/test/route.ts` change the type (line ~31):

```ts
  formData?: Record<string, string | string[]>;
```

and the append loop (lines ~41-42):

```ts
if (opts.formData) {
  for (const [k, v] of Object.entries(opts.formData)) {
    if (Array.isArray(v)) for (const item of v) formData.append(k, item);
    else formData.append(k, v);
  }
}
```

- [ ] **Step 4: Run tests, expect PASS** — `bun test src/test/route.test.ts` → PASS. Existing callers still typecheck (`Record<string,string>` ⊂ new type).

- [ ] **Step 5: Commit**

```bash
git add src/test/route.ts src/test/route.test.ts
git commit -m "test: support repeated form keys in makeRouteEvent"
```

---

## Task 3: `groupByMeal` pure helper + `RecentEntry.mealId`

**Files:**

- Create: `src/lib/utils/meals.ts`, `src/lib/utils/meals.test.ts`
- Modify: `src/lib/types.ts:17-25` (`RecentEntry` gains `mealId`)

**Interfaces:**

- Produces:

  ```ts
  export type MealGroup<T> = {
    mealId: string | null;
    members: T[];
    worst: ReactionId;
    givenAt: number;
  };
  export function groupByMeal<
    T extends { id: number; mealId: string | null; givenAt: number; reaction: ReactionId }
  >(rows: T[]): MealGroup<T>[];
  ```

  `rows` must already be sorted `givenAt` desc, `id` asc. Consecutive rows with the same non-null `mealId` form one group; every null-`mealId` row is its own singleton group. `worst` = highest `REACTION_RANK` among members. Group order follows first appearance.

- [ ] **Step 1: Write the failing test** — `src/lib/utils/meals.test.ts`:

```ts
import { test, expect } from 'bun:test';
import { groupByMeal } from './meals';

const row = (id: number, mealId: string | null, reaction: 'ras' | 'inconfort' | 'reaction') => ({
  id,
  mealId,
  reaction,
  givenAt: 1000 - id
});

test('groups consecutive same-mealId rows and derives worst-of reaction', () => {
  const groups = groupByMeal([
    row(1, 'm1', 'ras'),
    row(2, 'm1', 'reaction'),
    row(3, null, 'inconfort')
  ]);
  expect(groups.length).toBe(2);
  expect(groups[0].members.map((m) => m.id)).toEqual([1, 2]);
  expect(groups[0].worst).toBe('reaction');
  expect(groups[1].members.map((m) => m.id)).toEqual([3]);
  expect(groups[1].worst).toBe('inconfort');
});

test('two distinct meals sharing a givenAt stay separate', () => {
  const groups = groupByMeal([
    { id: 5, mealId: 'a', reaction: 'ras' as const, givenAt: 999 },
    { id: 6, mealId: 'b', reaction: 'ras' as const, givenAt: 999 }
  ]);
  expect(groups.map((g) => g.mealId)).toEqual(['a', 'b']);
});
```

- [ ] **Step 2: Run it, expect FAIL** — `bun test src/lib/utils/meals.test.ts` (module missing).

- [ ] **Step 3: Implement** — `src/lib/utils/meals.ts`:

```ts
import { REACTION_RANK } from '$lib/utils/reaction-values';
import type { ReactionId } from '$lib/utils/reactions';

export type MealGroup<T> = {
  mealId: string | null;
  members: T[];
  worst: ReactionId;
  givenAt: number;
};

/**
 * Fold entry rows into meal groups. Rows MUST be pre-sorted (givenAt desc, id
 * asc) so a meal's ingredients are contiguous. Null-mealId rows are singletons.
 */
export function groupByMeal<
  T extends { id: number; mealId: string | null; givenAt: number; reaction: ReactionId }
>(rows: T[]): MealGroup<T>[] {
  const groups: MealGroup<T>[] = [];
  for (const r of rows) {
    const last = groups[groups.length - 1];
    if (r.mealId !== null && last && last.mealId === r.mealId) {
      last.members.push(r);
      if (REACTION_RANK[r.reaction] > REACTION_RANK[last.worst]) last.worst = r.reaction;
    } else {
      groups.push({ mealId: r.mealId, members: [r], worst: r.reaction, givenAt: r.givenAt });
    }
  }
  return groups;
}
```

- [ ] **Step 4: Add `mealId` to `RecentEntry`** in `src/lib/types.ts`:

```ts
export type RecentEntry = {
  id: number;
  foodId: number;
  foodName: string;
  category: CategoryId;
  reaction: ReactionId;
  givenAt: number;
  texture: TextureKey | null;
  mealId: string | null;
};
```

- [ ] **Step 5: Heal the producer of `RecentEntry` in the same commit.** `mealId` is now a **required** field, and the dashboard load (`src/routes/child/[id]/+page.server.ts`) produces `RecentEntry[]`; without a matching projection `bun --bun svelte-check` goes RED. In that `recent` query add `mealId: foodEntries.mealId` to the `.select({...})` (~105-116), add `asc(foodEntries.id)` as a secondary sort (`.orderBy(desc(foodEntries.givenAt), asc(foodEntries.id))`, importing `asc`), and add `mealId: r.mealId` to the mapped `recent` objects (~246-256). (Task 11 then only touches `RecentFeed.svelte` — the grouping UI.) If `svelte-check` flags any other `RecentEntry` producer, add `mealId` there too.

- [ ] **Step 6: Run tests + typecheck, expect PASS** — `bun test src/lib/utils/meals.test.ts` → PASS; `bun --bun svelte-check` → clean (this is the gate D1 protects).

- [ ] **Step 7: Commit**

```bash
git add src/lib/utils/meals.ts src/lib/utils/meals.test.ts src/lib/types.ts src/routes/child/[id]/+page.server.ts
git commit -m "feat: groupByMeal helper + RecentEntry.mealId (+ dashboard projection)"
```

---

## Task 4: Batch insert in the log action

**Files:**

- Modify: `src/routes/child/[id]/log/+page.server.ts` (schema ~20-32, action ~163-251)
- Test: `src/routes/child/[id]/log/log.create.test.ts`

**Interfaces:**

- Consumes: `resolveOrInsertFood(input, tx)` → `{ ok:true; food; foodId } | { ok:false; reason }`; `newId()` from `$lib/offline/uuid`.
- Produces: the action accepts repeated `foodId` fields (+ optional single custom food), inserts one row per deduped food sharing a `mealId` (null when exactly one food), one audit event with `count`.

- [ ] **Step 1: Write the failing test** — add to `log.create.test.ts` (follow the existing setup helpers in that file for user/child/foods):

```ts
test('logs several foodIds as one meal sharing a mealId', async () => {
  const { user, child, foodIds } = await setupThreeFoods(); // reuse file's helpers
  const ev = makeRouteEvent({
    user: safeUser(user),
    memberships: [await seedMembership({ userId: user.id, childId: child.id })],
    params: { id: String(child.id) },
    formData: {
      foodId: foodIds.map(String), // 3 ids
      givenAt: new Date().toISOString(),
      reaction: 'ras'
    }
  });
  await captureFlow(() => actions.default(ev as never));

  const rows = await testDb
    .select()
    .from(schema.foodEntries)
    .where(eq(schema.foodEntries.childId, child.id));
  expect(rows.length).toBe(3);
  const mealIds = new Set(rows.map((r) => r.mealId));
  expect(mealIds.size).toBe(1);
  expect([...mealIds][0]).not.toBeNull();
});

test('logs a single foodId with mealId null (unchanged behaviour)', async () => {
  const { user, child, foodIds } = await setupThreeFoods();
  const ev = makeRouteEvent({
    user: safeUser(user),
    memberships: [await seedMembership({ userId: user.id, childId: child.id })],
    params: { id: String(child.id) },
    formData: { foodId: String(foodIds[0]), givenAt: new Date().toISOString(), reaction: 'ras' }
  });
  await captureFlow(() => actions.default(ev as never));
  const rows = await testDb
    .select()
    .from(schema.foodEntries)
    .where(eq(schema.foodEntries.childId, child.id));
  expect(rows.length).toBe(1);
  expect(rows[0].mealId).toBeNull();
});

test('deduplicates a repeated foodId into one row', async () => {
  const { user, child, foodIds } = await setupThreeFoods();
  const ev = makeRouteEvent({
    user: safeUser(user),
    memberships: [await seedMembership({ userId: user.id, childId: child.id })],
    params: { id: String(child.id) },
    formData: {
      foodId: [String(foodIds[0]), String(foodIds[0])],
      givenAt: new Date().toISOString(),
      reaction: 'ras'
    }
  });
  await captureFlow(() => actions.default(ev as never));
  const rows = await testDb
    .select()
    .from(schema.foodEntries)
    .where(eq(schema.foodEntries.childId, child.id));
  expect(rows.length).toBe(1);
});
```

- [ ] **Step 2: Run it, expect FAIL** — `bun test src/routes/child/[id]/log/log.create.test.ts`.

- [ ] **Step 3: Implement the parse + batch insert.** In `+page.server.ts`:

Change the schema to accept an array of ids (replace `foodId` in the zod object):

```ts
const schema = z
  .object({
    foodIds: z.array(z.coerce.number().int().positive()).default([]),
    'customFood.name': z.string().min(1).max(80).optional(),
    'customFood.category': z.string().optional(),
    givenAt: z.string().min(1, 'Date requise'),
    reaction: z.enum(REACTION_VALUES),
    texture: z.enum(TEXTURE_VALUES).optional(),
    notes: z.string().max(2000).optional()
  })
  .refine((d) => d.foodIds.length > 0 || !!d['customFood.name'], {
    message: 'Choisissez un aliment ou créez-en un.'
  });
```

Fix the raw parse (the `Object.fromEntries` at ~163 drops repeated keys) and import `newId`:

```ts
import { newId } from '$lib/offline/uuid';
// ...
const fd = await request.formData();
const raw = { ...Object.fromEntries(fd), foodIds: fd.getAll('foodId').map(String) };
const parsed = schema.safeParse(raw);
```

Replace the **entire** body of `work()` (from `resolveOrInsertFood` through the final `return buildLogRedirect(...)`) with the block below — it must still `return` a redirect or `work()` yields `undefined` and `localizedRedirect(undefined)` throws. The existing `const { food, foodId } = resolved` / single `snapshotPriorState(tx, childId, food.allergenType)` / single insert all go away. Milestones here keep **today's single-food semantics off the first resolved food** so the suite stays green; Task 5 swaps that block for the set-based version. Full body:

```ts
const resolvedFoods: { food: typeof foods.$inferSelect; foodId: number }[] = [];
const seen = new Set<number>();
// catalog ids
for (const id of parsed.data.foodIds) {
  const r = resolveOrInsertFood({ foodId: id, childId }, tx);
  if (!r.ok)
    throw new LogActionAbort(
      400,
      r.reason === 'not-found' ? 'Aliment introuvable.' : 'Aliment invalide.'
    );
  if (!seen.has(r.foodId)) {
    seen.add(r.foodId);
    resolvedFoods.push({ food: r.food, foodId: r.foodId });
  }
}
// optional single custom food
if (parsed.data['customFood.name']) {
  const r = resolveOrInsertFood(
    {
      customName: parsed.data['customFood.name'],
      customCategory: parsed.data['customFood.category'],
      childId
    },
    tx
  );
  if (!r.ok) throw new LogActionAbort(400, 'Aliment invalide.');
  if (!seen.has(r.foodId)) {
    seen.add(r.foodId);
    resolvedFoods.push({ food: r.food, foodId: r.foodId });
  }
}
if (resolvedFoods.length === 0) throw new LogActionAbort(400, 'Aucun aliment sélectionné.');

// Snapshot BEFORE any insert so milestones compare pre/post state. (Task 5
// replaces this single-food call with a set-based snapshot.)
const prior = snapshotPriorState(tx, childId, resolvedFoods[0].food.allergenType);

const mealId = resolvedFoods.length > 1 ? newId() : null;
for (const { foodId } of resolvedFoods) {
  tx.insert(foodEntries)
    .values({
      childId,
      foodId,
      givenAt: givenAtDate,
      reaction: parsed.data.reaction,
      texture: parsed.data.texture ?? null,
      notes: parsed.data.notes?.trim() || null,
      loggedBy: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      mealId
    })
    .run();
}
didInsert = true;

// Milestones: today's single-food logic off the first food (Task 5 makes this
// set-based). Keeps the existing first-food / first-allergen tests green.
const food = resolvedFoods[0].food;
const categoriesNowCovered = countCategoriesCovered(tx, childId);
const isFirstAllergen = prior.priorAllergenCount === 0 && food.allergenType != null;
const allAllergensJustCompleted =
  isFirstAllergen && prior.priorAllergensIntroduced + 1 === ALLERGENS.length;
return buildLogRedirect(childId, {
  priorEntryCount: prior.priorEntryCount,
  isFirstAllergen,
  allergenType: food.allergenType,
  allAllergensJustCompleted,
  categoriesNowCovered,
  priorCategoriesCovered: prior.priorCategoriesCovered
});
```

Update the post-commit audit to carry the count:

```ts
if (didInsert)
  audit({ type: 'food_entry.created', userId: user.id, childId, count: resolvedFoods.length });
```

`audit`'s event union is closed, so this **requires** adding `count?: number` to the `food_entry.created` variant in `src/lib/server/audit.ts` (it is not optional cleanup — the call is a type error without it).

- [ ] **Step 4: Run tests + typecheck, expect PASS** — `bun test src/routes/child/[id]/log/` (all log tests, incl. idempotency — the single-tx batch is already idempotent-safe) AND `bun --bun svelte-check`. The svelte-check gate is what catches a forgotten `count?: number` on the closed `audit` union (`bun test` strips types and would let it through to a later task). Fix any existing test that posted `foodId` and asserted single behaviour.

- [ ] **Step 5: Commit**

```bash
git add src/routes/child/[id]/log/+page.server.ts src/lib/server/audit.ts src/routes/child/[id]/log/log.create.test.ts
git commit -m "feat(log): insert multiple ingredients as one meal"
```

---

## Task 5: Milestone redirect — set-based allergens

**Files:**

- Modify: `src/routes/child/[id]/log/+page.server.ts` (`snapshotPriorState` ~86-127, `work()` milestone block ~224-236, `buildLogRedirect` ~131-149)
- Test: `src/routes/child/[id]/log/log.create.test.ts`

**Interfaces:**

- Consumes: `ALLERGENS` (length 12). Produces the redirect query still shaped `{ logged, first?, allergen?, allAllergens?, categories, prevCategories }`, now correct for a batch introducing 0/1/≥2 allergen types.

- [ ] **Step 1: Write the failing test:**

```ts
test('a meal introducing the final two allergens fires allAllergens', async () => {
  const { user, child } = await seedTenAllergensIntroduced(); // helper: 10 distinct allergen foods already logged
  const [f11, f12] = await twoNewAllergenFoodIds(); // 11th + 12th allergen types
  const ev = makeRouteEvent({
    user: safeUser(user),
    memberships: [await seedMembership({ userId: user.id, childId: child.id })],
    params: { id: String(child.id) },
    formData: {
      foodId: [String(f11), String(f12)],
      givenAt: new Date().toISOString(),
      reaction: 'ras'
    }
  });
  const res = await captureFlow(() => actions.default(ev as never));
  expect(res.kind).toBe('redirect');
  if (res.kind === 'redirect') expect(res.location).toContain('allAllergens=1');
});
```

- [ ] **Step 2: Run it, expect FAIL** (current `+1` formula yields `10+1 !== 12`).

- [ ] **Step 3a: Change `snapshotPriorState` to be set-based (pre-insert).** Drop its `allergenType` parameter and the now-unused `priorAllergenCount`; instead capture the set of allergen types already introduced, **before any insert**:

```ts
type PriorLogState = {
  priorEntryCount: number;
  priorCategoriesCovered: number;
  priorTypes: Set<string>; // allergen types already introduced, pre-insert
  priorAllergensIntroduced: number; // = priorTypes.size, kept for readability
};

function snapshotPriorState(tx: LogTx, childId: number): PriorLogState {
  const priorEntryCount =
    tx
      .select({ n: sql<number>`count(*)` })
      .from(foodEntries)
      .where(eq(foodEntries.childId, childId))
      .limit(1)
      .all()[0]?.n ?? 0;

  const priorTypes = new Set(
    tx
      .select({ t: foods.allergenType })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.childId, childId), sql`${foods.allergenType} is not null`))
      .all()
      .map((r) => r.t as string)
  );

  return {
    priorEntryCount,
    priorCategoriesCovered: countCategoriesCovered(tx, childId),
    priorTypes,
    priorAllergensIntroduced: priorTypes.size
  };
}
```

- [ ] **Step 3b: In `work()`, change the snapshot call** to `const prior = snapshotPriorState(tx, childId);` (no allergenType arg — this replaces the Task 4 call that passed `resolvedFoods[0].food.allergenType`). Add the distinct-count helper:

```ts
function distinctAllergensIntroduced(tx: LogTx, childId: number): number {
  return (
    tx
      .select({ n: sql<number>`count(distinct ${foods.allergenType})` })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.childId, childId), sql`${foods.allergenType} is not null`))
      .limit(1)
      .all()[0]?.n ?? 0
  );
}
```

- [ ] **Step 3c: Replace the Task 4 milestone block** (everything after `didInsert = true;`) with the set-based version. `prior.priorTypes` is the **pre-insert** snapshot, so it is never contaminated by the meal's own rows:

```ts
const afterDistinct = distinctAllergensIntroduced(tx, childId); // post-insert
const mealTypes = resolvedFoods.map((r) => r.food.allergenType).filter((t): t is string => !!t);
const newTypes = mealTypes.filter((t) => !prior.priorTypes.has(t));
// deterministic pick: first in ALLERGENS declaration order
const firstAllergen = ALLERGENS.map((a) => a.id).find((id) => newTypes.includes(id)) ?? null;

return buildLogRedirect(childId, {
  priorEntryCount: prior.priorEntryCount,
  isFirstAllergen: firstAllergen !== null,
  allergenType: firstAllergen,
  allAllergensJustCompleted:
    afterDistinct === ALLERGENS.length && prior.priorAllergensIntroduced < ALLERGENS.length,
  categoriesNowCovered: countCategoriesCovered(tx, childId),
  priorCategoriesCovered: prior.priorCategoriesCovered
});
```

`buildLogRedirect` is unchanged (still encodes one `allergen`).

- [ ] **Step 4: Run tests, expect PASS** — `bun test src/routes/child/[id]/log/`. Verify the existing single-food first-allergen test still passes.

- [ ] **Step 5: Commit**

```bash
git add src/routes/child/[id]/log/+page.server.ts src/routes/child/[id]/log/log.create.test.ts
git commit -m "feat(log): compute milestones set-based across a meal batch"
```

---

## Task 6: Offline queue — array-valued form fields

**Files:**

- Modify: `src/lib/offline/queue.ts:1-6` (type), `:114-115` (replay body)
- Test: `src/lib/offline/queue.test.ts` (create/extend)

**Interfaces:**

- Produces: `QueuedSubmit.formData: Record<string, string | string[]>`; `postOne` builds the POST body by appending each array element.

- [ ] **Step 1: Write the failing test:**

```ts
import { test, expect } from 'bun:test';
// If postOne is not exported, export it (or test via a small buildBody helper you extract).
import { buildBody } from './queue';

test('buildBody expands array values into repeated params', () => {
  const body = buildBody({ foodId: ['1', '2'], reaction: 'ras' });
  expect(body.getAll('foodId')).toEqual(['1', '2']);
  expect(body.get('reaction')).toBe('ras');
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement.** Change the interface:

```ts
export interface QueuedSubmit {
  key: string;
  childId: number;
  formData: Record<string, string | string[]>;
  queuedAt: number;
}
```

Extract and use a `buildBody`:

```ts
export function buildBody(form: Record<string, string | string[]>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(form)) {
    if (Array.isArray(v)) for (const item of v) body.append(k, item);
    else body.append(k, v);
  }
  return body;
}
```

and in `postOne` replace `const body = new URLSearchParams(row.formData);` with `const body = buildBody(row.formData);`.

- [ ] **Step 4: Run tests, expect PASS** — `bun test src/lib/offline/queue.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offline/queue.ts src/lib/offline/queue.test.ts
git commit -m "feat(offline): preserve repeated form keys through the queue"
```

---

## Task 7: FoodCombobox — `multiple` prop

**Files:**

- Modify: `src/lib/components/FoodCombobox.svelte`
- Test: `src/lib/components/FoodCombobox.multiple.test.ts` (Svelte component test — follow the pattern of any existing `*.svelte` component test in the repo; if none, assert rendered hidden inputs via `@testing-library/svelte` already used in E2E — otherwise cover this behaviour in the Task 8 page test and make this a render-smoke test.)

**Interfaces:**

- Consumes: `SvelteSet` from `svelte/reactivity`.
- Produces: with `multiple` truthy, the component keeps the list visible, tracks a `SvelteSet<number>` of selected ids shown as removable chips, and emits one `<input type="hidden" name="foodId">` per selected id. Also accepts `introducedFoodIds?: Set<number>` used by the page for the hint (the combobox just exposes selection; the hint lives on the page).
- When `multiple` is false/omitted, behaviour is byte-for-byte the current single-select.

- [ ] **Step 1: Write the failing test** — render with `multiple` and 2 foods, click both, assert two hidden `foodId` inputs with the right values; render without `multiple`, assert current single-select markup (one `foodId` input after a pick). (Use the repo's component-test harness.)

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement.** Add to props:

```ts
    multiple = false,
    introducedFoodIds
  }: {
    foods: FoodOption[];
    name?: string;
    customName?: string;
    initialFoodId?: number | null;
    multiple?: boolean;
    introducedFoodIds?: Set<number>;
    onCustomToggle?: (open: boolean) => void;
    onSelectionChange?: (ids: number[]) => void;
  } = $props();
```

Add multi state and a branch that does NOT collapse the list:

```ts
import { SvelteSet } from 'svelte/reactivity';
const selectedIds = new SvelteSet<number>(initialFoodId ? [initialFoodId] : []);
function toggle(id: number) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  onSelectionChange?.([...selectedIds]);
}
const selectedFoods = $derived(foods.filter((f) => selectedIds.has(f.id)));
```

In the template, when `multiple`: render a chip row above the always-visible list (each chip: name + remove button calling `toggle`), the list button calls `toggle(f.id)` instead of `pick`, and emit hidden inputs:

```svelte
{#each selectedFoods as f (f.id)}
  <input type="hidden" name="foodId" value={f.id} />
{/each}
```

Keep the entire existing `{#if selected}…{:else}…{/if}` single-select path untouched under `{#if !multiple}`. Extract the search bar + custom-food block into `{#snippet}`s so both modes reuse them without duplicating markup.

- [ ] **Step 4: Run the Svelte MCP autofixer** on the edited component (the `svelte:svelte-file-editor` agent / MCP `svelte-autofixer`) and fix any reported issues, then re-run.

- [ ] **Step 5: Run tests, expect PASS** — `bun test src/lib/components/FoodCombobox.multiple.test.ts` and `bun --bun svelte-check`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/FoodCombobox.svelte src/lib/components/FoodCombobox.multiple.test.ts
git commit -m "feat(ui): multi-select mode for FoodCombobox"
```

---

## Task 8: Log page — multi-select wiring, never-tried hint, offline capture

**Files:**

- Modify: `src/routes/child/[id]/log/+page.server.ts` (`load` — add `introducedFoodIds`)
- Modify: `src/routes/child/[id]/log/+page.svelte` (use `multiple`, hint, offline capture)
- Modify: `messages/fr.json`, `messages/en.json`
- Test: `src/routes/child/[id]/log/log.create.test.ts` (load returns introducedFoodIds) + a component/e2e assertion for the hint

**Interfaces:**

- Consumes: `FoodCombobox` `multiple` + `onSelectionChange`; `groupByMeal` not needed here.
- Produces: `load` returns `introducedFoodIds: number[]` (distinct `foodId` for the child).

- [ ] **Step 1: Write the failing test** (server load):

```ts
test("log load returns the child's already-tried foodIds", async () => {
  const { user, child, foodIds } = await setupThreeFoods();
  await logOneFood(child.id, foodIds[0]); // helper inserts a food_entries row
  const ev = makeRouteEvent({
    user: safeUser(user),
    memberships: [
      /*owner*/
    ],
    params: { id: String(child.id) }
  });
  const data = await load(ev as never);
  expect(data.introducedFoodIds).toContain(foodIds[0]);
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Add the query** in `load` (mirrors the menu loader):

```ts
const introduced = await db
  .selectDistinct({ foodId: foodEntries.foodId })
  .from(foodEntries)
  .where(eq(foodEntries.childId, childId));
return { foods: list, introducedFoodIds: introduced.map((r) => r.foodId) };
```

- [ ] **Step 4: Wire the page** `+page.svelte`. Track selection and custom-open state via the combobox's existing callbacks — do NOT reference the combobox's internal `customNameValue` (it isn't in page scope; that was defect D2). A custom food being added is, by definition, never-tried, so count it via the `onCustomToggle` open flag:

```svelte
<FoodCombobox
  foods={data.foods}
  multiple
  introducedFoodIds={new Set(data.introducedFoodIds)}
  onSelectionChange={(ids) => (selectedIds = ids)}
  onCustomToggle={(open) => (customActive = open)}
/>
{#if neverTriedCount >= 2}
  <p class="text-xs text-muted-foreground">{m.logFormNeverTriedHint()}</p>
{/if}
```

```ts
let selectedIds = $state<number[]>([]);
let customActive = $state(false);
const introducedSet = $derived(new Set(data.introducedFoodIds));
const neverTriedCount = $derived(
  selectedIds.filter((id) => !introducedSet.has(id)).length + (customActive ? 1 : 0)
);
```

**Also delete the now-dead `initialFoodId` const** (the old single-select `<FoodCombobox {initialFoodId} />` was its only consumer; leaving it triggers `no-unused-vars`, and lint-staged blocks the commit — which the plan forbids bypassing). If you still want to preseed a selection from `?foodId=`, seed `selectedIds` from it instead.

- Offline capture fix: in the `use:enhance` offline branch, replace the last-wins `formData.forEach((v,k)=>{formObj[k]=v})` with getAll-aware capture:

```ts
const formObj: Record<string, string | string[]> = {};
for (const key of new Set([...formData.keys()])) {
  const all = formData.getAll(key).filter((v): v is string => typeof v === 'string');
  formObj[key] = all.length > 1 ? all : all[0];
}
```

- [ ] **Step 5: Add i18n keys** via the `i18n-add-key` skill:
  - `logFormNeverTriedHint` — FR: "Introduisez les nouveaux aliments un par un pour repérer plus facilement une réaction." EN: "Introduce new foods one at a time so a reaction is easier to trace."
  - `logFormMultiSelectHelp` — FR: "Ajoutez tous les ingrédients du repas." EN: "Add every ingredient of the meal."

- [ ] **Step 6: Svelte autofixer** on `+page.svelte`, then `bun --bun svelte-check` and `bun test src/routes/child/[id]/log/`.

- [ ] **Step 7: Commit**

```bash
git add src/routes/child/[id]/log/ messages/fr.json messages/en.json
git commit -m "feat(log): multi-ingredient picker + never-tried hint + offline capture"
```

---

## Task 9: Meal-mode server — detection, `update`, `deleteMeal`, `removeIngredient`

**Files:**

- Modify: `src/routes/child/[id]/log/[entryId]/+page.server.ts`
- Test: `src/routes/child/[id]/log/[entryId]/page.server.test.ts`

**Interfaces:**

- Produces: `load` returns `meal: { members: {id, foodId, foodName, reaction}[] } | null`. Actions: `update` (shared givenAt/texture/notes to all siblings + dirty-only guarded per-ingredient reaction), `deleteMeal`, `removeIngredient` (deletes one; nulls survivor's mealId when one remains).

- [ ] **Step 1: Write the failing tests:**

```ts
test('meal-mode update writes shared fields to all siblings and does not touch unchanged reactions', async () => {
  const { child, m1, ids } = await seedMeal(['ras', 'ras']); // helper: 2-ingredient meal, both ras
  // promote one sibling out-of-band (simulates a symptom)
  await testDb
    .update(schema.foodEntries)
    .set({ reaction: 'reaction' })
    .where(eq(schema.foodEntries.id, ids[1]));
  const ev = makeRouteEvent({
    user,
    memberships,
    params: { id: String(child.id), entryId: String(ids[0]) },
    formData: {
      givenAt: new Date().toISOString(),
      texture: 'lisse',
      notes: 'x',
      // each ingredient submits reaction == reactionLoaded (nothing changed), so
      // the dirty-only guard issues zero reaction writes
      [`reaction.${ids[0]}`]: 'ras',
      [`reactionLoaded.${ids[0]}`]: 'ras',
      [`reaction.${ids[1]}`]: 'reaction',
      [`reactionLoaded.${ids[1]}`]: 'reaction'
    }
  });
  await captureFlow(() => actions.update(ev as never));
  const rows = await testDb
    .select()
    .from(schema.foodEntries)
    .where(eq(schema.foodEntries.mealId, m1));
  expect(rows.every((r) => r.notes === 'x' && r.texture === 'lisse')).toBe(true);
  expect(rows.find((r) => r.id === ids[1])!.reaction).toBe('reaction'); // promotion preserved
});

test('a stale date-only edit does not clobber a concurrently-promoted reaction', async () => {
  const { child, m1, ids } = await seedMeal(['ras', 'ras']);
  // The form loaded with both at 'ras'. A co-parent then promotes sibling ids[1].
  await testDb
    .update(schema.foodEntries)
    .set({ reaction: 'reaction' })
    .where(eq(schema.foodEntries.id, ids[1]));
  // The user submits the stale form: date/notes changed, reactions still the LOADED 'ras'.
  const ev = makeRouteEvent({
    user,
    memberships,
    params: { id: String(child.id), entryId: String(ids[0]) },
    formData: {
      givenAt: new Date().toISOString(),
      notes: 'new note',
      [`reaction.${ids[0]}`]: 'ras',
      [`reactionLoaded.${ids[0]}`]: 'ras',
      [`reaction.${ids[1]}`]: 'ras',
      [`reactionLoaded.${ids[1]}`]: 'ras'
    }
  });
  await captureFlow(() => actions.update(ev as never));
  const rows = await testDb
    .select()
    .from(schema.foodEntries)
    .where(eq(schema.foodEntries.mealId, m1));
  // Shared field applied to all; the promotion on ids[1] survived (guarded WHERE reaction='ras' no-op).
  expect(rows.every((r) => r.notes === 'new note')).toBe(true);
  expect(rows.find((r) => r.id === ids[1])!.reaction).toBe('reaction');
});

test('removeIngredient down to one nulls the survivor mealId', async () => {
  const { child, ids } = await seedMeal(['ras', 'ras']);
  const ev = makeRouteEvent({
    user,
    memberships,
    params: { id: String(child.id), entryId: String(ids[0]) },
    formData: { removeId: String(ids[0]) }
  });
  await captureFlow(() => actions.removeIngredient(ev as never));
  const survivor = (
    await testDb.select().from(schema.foodEntries).where(eq(schema.foodEntries.id, ids[1]))
  )[0];
  expect(survivor.mealId).toBeNull();
});

test('deleteMeal removes all siblings', async () => {
  const { child, m1, ids } = await seedMeal(['ras', 'ras', 'ras']);
  const ev = makeRouteEvent({
    user,
    memberships,
    params: { id: String(child.id), entryId: String(ids[0]) },
    formData: {}
  });
  await captureFlow(() => actions.deleteMeal(ev as never));
  const rows = await testDb
    .select()
    .from(schema.foodEntries)
    .where(eq(schema.foodEntries.mealId, m1));
  expect(rows.length).toBe(0);
});
```

- [ ] **Step 2: Run them, expect FAIL.**

- [ ] **Step 3: Implement.** In `load`, after loading the entry, if `entry.mealId` is non-null load siblings:

```ts
const siblings = entry.mealId
  ? await db.select({ id: foodEntries.id, foodId: foodEntries.foodId, foodName: foods.name, reaction: foodEntries.reaction })
      .from(foodEntries).innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.mealId, entry.mealId), eq(foodEntries.childId, childId)))
      .orderBy(asc(foodEntries.id))
  : [];
const meal = siblings.length > 1 ? { mealId: entry.mealId as string, members: siblings } : null;
return { /* existing */, meal };
```

Add three actions (keep the existing `update` for the single-entry, non-meal path; branch on presence of the meal fields, or add distinct action names as below):

```ts
update: async ({ request, params, locals }) => {
  // If this entry is a meal member, do the shared+per-ingredient write; else the existing single-entry update.
  const raw = Object.fromEntries(await request.formData());
  const entry = await loadEntry(entryId, childId);
  if (entry.mealId) {
    const givenAtDate = new Date(String(raw.givenAt));
    if (Number.isNaN(givenAtDate.getTime())) return fail(400, { error: 'Date invalide.' });
    // Validate texture against the enum — an unchecked value hits the DB CHECK
    // and 500s instead of returning a graceful 400 (the single-entry path uses
    // a zod enum; mirror it here). TEXTURE_VALUES is already imported.
    const rawTexture = raw.texture === '' || raw.texture == null ? null : String(raw.texture);
    if (rawTexture !== null && !TEXTURE_VALUES.includes(rawTexture as never)) {
      return fail(400, { error: 'Texture invalide.' });
    }
    const texture = rawTexture as (typeof TEXTURE_VALUES)[number] | null;
    const notes = String(raw.notes ?? '').trim() || null;
    const members = await db.select({ id: foodEntries.id, reaction: foodEntries.reaction })
      .from(foodEntries).where(and(eq(foodEntries.mealId, entry.mealId), eq(foodEntries.childId, childId)));
    db.transaction((tx) => {
      // shared fields to all
      tx.update(foodEntries).set({ givenAt: givenAtDate, texture, notes, updatedAt: new Date() })
        .where(and(eq(foodEntries.mealId, entry.mealId!), eq(foodEntries.childId, childId))).run();
      // dirty-only, optimistically-guarded per-ingredient reaction
      for (const mem of members) {
        const submitted = raw[`reaction.${mem.id}`];
        const loaded = String(raw[`reactionLoaded.${mem.id}`] ?? mem.reaction);
        if (typeof submitted === 'string' && submitted !== loaded && REACTION_VALUES.includes(submitted as never)) {
          tx.update(foodEntries)
            .set({ reaction: submitted as (typeof REACTION_VALUES)[number], updatedAt: new Date() })
            .where(and(eq(foodEntries.id, mem.id), eq(foodEntries.childId, childId), eq(foodEntries.reaction, loaded as never)))
            .run();
        }
      }
    });
    audit({ type: 'food_entry.updated', userId: user.id, childId, entryId });
    throw localizedRedirect(locals.locale, 303, destinationFor(String(raw.from ?? ''), childId, entryId, 'update'));
  }
  /* ...existing single-entry update unchanged... */
},

deleteMeal: async ({ request, params, locals }) => {
  const entry = await loadEntry(entryId, childId);
  if (!entry.mealId) return fail(400, { error: 'Repas introuvable.' });
  await db.delete(foodEntries).where(and(eq(foodEntries.mealId, entry.mealId), eq(foodEntries.childId, childId)));
  audit({ type: 'food_entry.deleted', userId: user.id, childId, entryId });
  const from = String((await request.formData()).get('from') ?? '');
  throw localizedRedirect(locals.locale, 303, destinationFor(from, childId, entryId, 'delete'));
},

removeIngredient: async ({ request, params, locals }) => {
  const fd = await request.formData();
  const removeId = Number(fd.get('removeId'));
  const entry = await loadEntry(entryId, childId);
  if (!entry.mealId || !Number.isInteger(removeId)) return fail(400, { error: 'Requête invalide.' });
  // db.transaction returns the callback value synchronously (bun:sqlite).
  const landOn = db.transaction((tx) => {
    tx.delete(foodEntries)
      .where(and(eq(foodEntries.id, removeId), eq(foodEntries.childId, childId), eq(foodEntries.mealId, entry.mealId!)))
      .run();
    const rest = tx.select({ id: foodEntries.id }).from(foodEntries)
      .where(and(eq(foodEntries.mealId, entry.mealId!), eq(foodEntries.childId, childId)))
      .orderBy(asc(foodEntries.id)).all();
    if (rest.length === 1) {
      tx.update(foodEntries).set({ mealId: null, updatedAt: new Date() })
        .where(eq(foodEntries.id, rest[0].id)).run();
    }
    // Redirect target must be a SURVIVING entry — never `removeId`/`entryId`,
    // which is usually the anchor the editor opened on (deleting it then
    // redirecting to /log/{entryId} 404s). rest[0] is the lowest surviving id.
    return rest[0]?.id ?? null;
  });
  audit({ type: 'food_entry.updated', userId: user.id, childId, entryId });
  throw localizedRedirect(
    locals.locale,
    303,
    landOn === null ? `/child/${childId}/foods` : `/child/${childId}/log/${landOn}`
  );
}
```

The form (Task 10) MUST submit both `reaction.<id>` (current control) and `reactionLoaded.<id>` (value at page load) for every member so the guard is exact — the `?? mem.reaction` fallback is only a safety net, not a substitute. `REACTION_VALUES` and `TEXTURE_VALUES` are already imported; add `asc` to the drizzle imports if not present.

Add a test asserting the anchor-removal redirect target (guards the 404 regression):

```ts
test('removeIngredient on the anchor redirects to a surviving entry, not a 404', async () => {
  const { child, ids } = await seedMeal(['ras', 'ras', 'ras']);
  const ev = makeRouteEvent({
    user,
    memberships,
    params: { id: String(child.id), entryId: String(ids[0]) },
    formData: { removeId: String(ids[0]) } // remove the anchor itself
  });
  const res = await captureFlow(() => actions.removeIngredient(ev as never));
  expect(res.kind).toBe('redirect');
  if (res.kind === 'redirect') {
    expect(res.location).not.toContain(`/log/${ids[0]}`);
    expect(res.location).toContain(`/log/${ids[1]}`);
  }
});
```

- [ ] **Step 4: Run tests, expect PASS** — `bun test src/routes/child/[id]/log/[entryId]/`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/child/[id]/log/[entryId]/+page.server.ts src/routes/child/[id]/log/[entryId]/page.server.test.ts
git commit -m "feat(log): meal-mode edit/delete with per-ingredient reaction"
```

---

## Task 10: Meal-mode edit UI

**Files:**

- Modify: `src/routes/child/[id]/log/[entryId]/+page.svelte`
- Modify: `messages/fr.json`, `messages/en.json`

**Interfaces:**

- Consumes: `data.meal` from Task 9.

- [ ] **Step 1:** Guard the page: `{#if data.meal}` render meal mode, `{:else}` keep the current single-entry form untouched.
- [ ] **Step 2:** Meal mode renders: shared `givenAt` (datetime-local), shared `TexturePicker`, shared `notes`, then a list — one row per `data.meal.members` with the food name, a `ReactionPicker` named `reaction.{id}` bound to that member's reaction, a hidden `reactionLoaded.{id}` set to the loaded reaction, and a "Retirer" button posting `removeIngredient` with `removeId={id}`. A link on each ingredient to `/child/{id}/foods/{member.id}` (attach symptoms). Submit posts `update`; a separate "Supprimer le repas" posts `deleteMeal`.
- [ ] **Step 3:** i18n keys via `i18n-add-key`: `mealEditTitle` (FR "Modifier le repas"), `mealEditRemoveIngredient` (FR "Retirer"), `mealEditDelete` (FR "Supprimer le repas"), `mealEditIngredientReactionLabel` (FR "Réaction pour {food}").
- [ ] **Step 4:** Svelte autofixer + `bun --bun svelte-check`.
- [ ] **Step 5:** Manual check via the `run`/`webapp-testing` skill: log a 3-ingredient meal, open it, change the date, demote one ingredient to `ras`, remove one ingredient, delete the meal. Confirm each behaves per spec.
- [ ] **Step 6: Commit**

```bash
git add src/routes/child/[id]/log/[entryId]/ messages/fr.json messages/en.json
git commit -m "feat(ui): meal-mode edit form"
```

---

## Task 11: Dashboard recent feed — grouped meal cards

**Files:**

- Modify: `src/lib/components/bento/RecentFeed.svelte` (the `recent` **projection/mapping/ordering was already added in Task 3, Step 5** — do not repeat it; this task is the grouping UI only)
- Test: `src/routes/child/[id]/page.server.test.ts` (or the existing dashboard test file)

**Interfaces:**

- Consumes: `groupByMeal`, `data.recent` (already carries `mealId`, sorted `givenAt` desc / `id` asc from Task 3). Produces: `RecentFeed` renders each group of >1 as a meal card linking to `/child/{id}/log/{firstMemberId}?from=dashboard`, and singletons as today.

- [ ] **Step 1: Write a characterization test** — after logging a 3-ingredient meal, `groupByMeal(load().recent)` yields one group of 3 sharing a `mealId`. NOTE: the projection + `groupByMeal` already exist (Tasks 3, 3), so this test passes immediately — it pins the loader→grouping contract the feed depends on rather than driving new code. The `RecentFeed.svelte` render change itself is covered by `bun --bun svelte-check` (Step 5) and the final manual smoke (a real 3-ingredient meal must show as ONE card).
- [ ] **Step 2: Run it, expect PASS** (contract already satisfied by Task 3).
- [ ] **Step 3:** In `RecentFeed.svelte`, compute `const groups = $derived(groupByMeal(entries))` and render groups: `members.length > 1` → a meal card (ingredient names joined, worst-of reaction badge reusing the existing reaction styling, link to the first member's meal editor); else the existing single-row rendering. Slice to 5 **groups** (not rows).
- [ ] **Step 4:** i18n: `mealCardIngredientCount` (FR "{count} ingrédients") if a count label is shown.
- [ ] **Step 5:** Svelte autofixer + `bun --bun svelte-check` + `bun test`.
- [ ] **Step 6: Commit**

```bash
git add src/lib/components/bento/RecentFeed.svelte messages/*.json
git commit -m "feat(dashboard): group meal ingredients into one recent-feed card"
```

---

## Task 12: Co-parent activity — group meals

**Files:**

- Modify: `src/lib/server/guidance/queries/timeline.ts` (`loadCoparentActivity` ~82-119; `CoparentEntry` type)
- Modify: `src/lib/components/CoparentsSection.svelte`
- Test: `src/lib/server/guidance/queries/timeline.test.ts`

- [ ] **Step 1: Write the failing test** — a co-parent's 3-ingredient meal yields one grouped entry.
- [ ] **Step 2: Run it, expect FAIL.**
- [ ] **Step 3:** Add `mealId: foodEntries.mealId` to the select and mapped object; add `.orderBy(desc(foodEntries.givenAt), asc(foodEntries.id))`; add `mealId: string | null` to `CoparentEntry`.
- [ ] **Step 4:** In `CoparentsSection.svelte`, run co-parent entries through `groupByMeal` and render a meal as one "X a enregistré {n} ingrédients" line.
- [ ] **Step 5:** Svelte autofixer + `bun --bun svelte-check` + `bun test`.
- [ ] **Step 6: Commit**

```bash
git add src/lib/server/guidance/queries/timeline.ts src/lib/components/CoparentsSection.svelte messages/*.json
git commit -m "feat(dashboard): group co-parent meal activity"
```

---

## Task 13: Report — annotate `notable` (no grouping)

**Files:**

- Modify: `src/routes/child/[id]/report/+page.server.ts` (project `mealId` into the entries feeding `notable`)
- Modify: `src/routes/child/[id]/report/+page.svelte` (annotation)
- Test: `src/routes/child/[id]/report/page.server.test.ts`

- [ ] **Step 1: Write the failing test** — a meal with TWO reacted ingredients produces TWO `notable` lines, each carrying `mealId` (proving no collapse).
- [ ] **Step 2: Run it, expect FAIL** (mealId not projected).
- [ ] **Step 3:** Add `mealId` to the entries select that builds `notable`, **and to the `ReportEntry`-shaped type + the `.map` object** the notable list is projected into (otherwise svelte-check flags an excess/missing property). Keep `notable` as-is (one line per reacted entry — do NOT group).
- [ ] **Step 4:** In `+page.svelte`, when a notable line's `mealId` is non-null, append the `m.reportNotableInMeal()` tag.
- [ ] **Step 5:** i18n `reportNotableInMeal` — FR "dans un repas", EN "in a meal".
- [ ] **Step 6:** `bun --bun svelte-check` + `bun test`.
- [ ] **Step 7: Commit**

```bash
git add src/routes/child/[id]/report/ messages/*.json
git commit -m "feat(report): annotate meal membership without collapsing reactions"
```

---

## Task 14: GDPR export — include `mealId`

**Files:**

- Modify: `src/lib/server/gdpr.ts` (the `entryRows` projection, ~265-280)
- Test: `src/lib/server/gdpr.test.ts`

- [ ] **Step 1: Write the failing test** — export for a user whose child has a meal includes `mealId` on the meal's entry rows.
- [ ] **Step 2: Run it, expect FAIL.**
- [ ] **Step 3:** Add `mealId: foodEntries.mealId` to the `entryRows` `.select({...})`.
- [ ] **Step 4:** `bun test src/lib/server/gdpr.test.ts` → PASS.
- [ ] **Step 5: Commit**

```bash
git add src/lib/server/gdpr.ts src/lib/server/gdpr.test.ts
git commit -m "feat(gdpr): include mealId in data export"
```

---

## Final verification

- [ ] `bun test` — full suite green.
- [ ] `bun --bun svelte-check` — clean.
- [ ] `bun run test:e2e` — Playwright green (reset throwaway SQLite first, per README).
- [ ] `graphify update .` — refresh the code graph.
- [ ] Manual smoke via the `run` skill: log a potato+carrot+chicken meal, see one dashboard card, open it, correct a reaction, remove an ingredient, delete the meal; confirm the per-food carnet still shows each ingredient as its own food card and the report lists reacted ingredients individually.

## Self-review notes (coverage map)

- Spec "Data model" → Task 1. "groupByMeal" → Task 3. "Create/batch" → Task 4. "Milestones" → Task 5. "Offline" → Task 6. "FoodCombobox multiple" → Task 7. "never-tried hint / capture / introduced query" → Task 8. "Meal edit/delete + per-ingredient dirty reaction" → Tasks 9-10. "Dashboard feed" → Task 11. "Co-parent feed" → Task 12. "Report granular" → Task 13. "GDPR" → Task 14.
- Reaction-per-ingredient rule enforced in Tasks 4 (equal at create), 9 (dirty-only guarded write), 13 (no report collapse).
- `mealId != null ⇔ meal` invariant: created in Task 4 (>1 only), preserved in Task 9 (`removeIngredient` null-on-shrink).
