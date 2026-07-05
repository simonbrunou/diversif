# Multi-ingredient meals — design

**Date:** 2026-07-05
**Status:** Approved (design), pending implementation plan

Council review: 3 rounds (architect/correctness · implementation/testability ·
contrarian/red-team) — unanimous SOUND for v1. Round 1 caught the reaction-clobber
blocker, the missing symptom-attach path, and the wrong host surface; round 2
caught report-notable over-grouping + uneditable meal reactions; round 3 required
the dirty-only/guarded reaction write. All addressed above. Residual (accepted,
non-blocking): the same-row last-write-wins window on a stale open form is at
parity with the app's existing standalone-edit behavior; feed meals straddling the
20-row fetch may render partial; `countNthExposition` slightly overstates certainty
for blended repeats.

## Problem

Babies eat prepared/blended meals — e.g. a jar of potato + carrot + chicken.
Today the log flow (`/child/[id]/log`) is one food per submit, so logging one
mixed meal means running the flow three times. Users want to pick several
ingredients and log them in one go, and see/edit/delete that meal as a unit.

## Goal

- Select multiple ingredients in one log submission.
- Those ingredients render as **one grouped meal card**, editable and deletable
  as a unit.
- Each ingredient remains a real `food_entries` row, so diversification /
  allergen / category tracking keeps working with no changes to those queries.

## Non-goals (v1)

- No reusable/named meal presets ("re-log this jar").
- No **adding** ingredients when editing an existing meal (remove-only — forgot
  something → log a second meal).
- No multiple custom (one-off) foods in a single meal — at most one custom food
  per meal alongside catalogue foods.
- **No new full-history timeline view.** Meals surface in the existing
  per-event surfaces (dashboard recent activity + report); the per-food carnet
  is unchanged (see "History surfaces").

## Core correctness rule: reaction stays per-ingredient

This is the rule the rest of the design bends around, so it comes first.

`reaction` is **per-ingredient and independently mutable**. The symptom flow
promotes exactly **one** `food_entries` row's reaction from `ras`
(`src/lib/server/db/symptoms.ts:66`, `WHERE id=? AND reaction='ras'`): if a baby
reacts and the parent attaches an `urticaire` symptom to the chicken, only the
chicken row escalates to `reaction`. That is correct — the culprit is that food.

Therefore a meal **must never** write `reaction` across siblings with a single
shared value. Doing so would either fabricate reactions on ingredients that
never had one, or **erase a recorded allergy signal** — the worst possible bug
in an allergen-safety tracker. The "always written together" intuition is
already false at v1 because of promotion.

Consequences, applied throughout:

- **Create**: at log time the parent has observed one reaction to the whole
  meal, so all ingredients are inserted with the **same** reaction. Fine — they
  legitimately start equal; divergence only happens later via symptom-attach.
- **Meal-level edit**: `givenAt`, `texture`, `notes` are **shared** (one control,
  written to all siblings). `reaction` is edited **per ingredient** — the meal
  editor renders one reaction control **per row**, and each writes only its own
  row. This never clobbers a symptom-promoted value and is the only place a
  mis-tapped reaction can be corrected (incl. demoted back to `ras`, which
  symptom promotion cannot do). See "Edit / delete".
- **Meal card badge**: derived read-only as **worst-of** reaction across the
  ingredients (reuse the `severity` map from
  `aggregateBentoFoods`, `src/routes/child/[id]/foods/+page.server.ts:92`). Pure
  max over siblings — always consistent, even after one is promoted.

## Data model — group token, no new table

Add one nullable column to `food_entries`:

```
mealId TEXT   -- nullable; indexed
```

- `null` → standalone entry (all existing rows, and every future single-food
  log). **No backfill; existing single-food behaviour is unchanged.**
- non-null (a UUID from `newId()`) → member of a multi-ingredient meal; all
  siblings share the value.

**Single invariant for "is this a meal?": `mealId != null`.** A meal always has
≥2 members. It is created only when >1 food is resolved, and when a meal is
reduced to a single surviving ingredient we **null out** that survivor's
`mealId` (see edit/delete). So timeline grouping, edit-mode detection, and the
card predicate all use the same test — no "size>1 here, non-null there" split.

### Why not a `meals` parent table

`reaction`, `texture`, `notes` already live on `food_entries`, and — per the
core rule above — reaction is inherently per-ingredient because symptoms promote
one row. A `meals` parent that owned reaction would fight the symptom model and
force a migration through every read path. A group token keeps every ingredient
a real row, so `aggregateBentoFoods`, `countCategoriesCovered`
(`log/+page.server.ts:65`), the report aggregates, allergen-status, and streak
queries stay `foodId`/`childId`-scoped and `mealId`-agnostic — untouched.

```
// ponytail: mealId is a group token, not an FK. texture/notes are shared across
// a meal's rows and edited together; reaction is deliberately per-ingredient
// (symptom promotion mutates one row). Introduce a meals table only if per-meal
// fields ever need to diverge from per-ingredient ones.
```

### Migration & integrity

- `bun run db:generate` after editing `src/lib/server/db/schema.ts` →
  new file in `drizzle/`. Nullable additive TEXT, no default → no table rewrite,
  no backfill.
- **Index** on `mealId` (grouping/lookup by meal).
- **Partial unique index** on `(mealId, foodId) WHERE mealId IS NOT NULL` to
  hard-guard against duplicate ingredients in one meal (defence in depth over
  the client/server dedupe below).
- Every SELECT that feeds a grouping surface must **project `mealId`** (today
  none do) and add a **stable secondary sort** `asc(id)` after
  `desc(givenAt)` so a meal's ingredients render in a deterministic order and
  meals that share a `givenAt` don't interleave.

## Create flow — multi-select

**Component (`src/lib/components/FoodCombobox.svelte`):** add a `multiple` prop.

- `multiple=false` (default) → unchanged single-select behaviour. The
  single-entry edit page (`log/[entryId]`) keeps using this untouched, and a
  regression test asserts identical behaviour when the prop is omitted.
- `multiple=true` → the search/filter list stays visible; picking a food adds it
  to a selection rendered as removable chips. Emits one hidden
  `<input name="foodId">` per selected food. This is a **second render mode**,
  not just a prop toggle — the current `{#if selected}card{:else}list{/if}` fork
  is replaced by "list always visible + chip row" in multi mode. Extract the
  search bar + custom-food subform into snippets so single-select code is not
  disturbed.
- **Svelte 5**: chip selection state must use `SvelteSet` from
  `svelte/reactivity` (a plain `$state(new Set())` does not react to
  `.add()`/`.delete()`), or a plain array with reassignment.
- Custom food (≤1) unchanged; its `customFood.name` / `.category` fields coexist
  with the repeated `foodId` fields.

**Server (`src/routes/child/[id]/log/+page.server.ts`):**

- **Parse fix (critical):** the action currently does
  `Object.fromEntries(await request.formData())` (line 163) which **drops
  repeated keys**. Build `raw` as
  `{ ...Object.fromEntries(fd), foodIds: fd.getAll('foodId') }` (or parse the
  `FormData` directly) so multiple ids survive. Zod: `foodIds` = array of
  positive ints; plus the optional single custom food; require ≥1 resolved food;
  reject >1 `customFood.name`.
- In the existing write transaction: resolve each food id (+ optional custom)
  via `resolveOrInsertFood`, **dedupe** resolved ids, generate
  `mealId = newId()` **iff** the deduped resolved count > 1 (else `null`), insert
  N rows sharing `mealId / givenAt / reaction / texture / notes / loggedBy`.
- Idempotency is unchanged and already correct: `withIdempotencyKey` wraps the
  whole `work` (resolve N + snapshot + N inserts + redirect) in one synchronous
  bun:sqlite transaction — replay returns the cached redirect without
  re-inserting; any mid-batch throw rolls back the entire tx (no partial meal).
- **Audit**: emit one `food_entry.created` event carrying a `count` (or N
  events) so a 3-ingredient meal isn't logged as a single insert.

### Milestone redirect — set-based generalization (not "reuse as-is")

`snapshotPriorState` today takes **one** `allergenType` and computes one
`priorAllergenCount` (`log/+page.server.ts:99-108`); `buildLogRedirect` encodes
one allergen (`:144`); the all-allergens test is `priorAllergensIntroduced + 1
=== ALLERGENS.length` (`:227`). None of these are correct for a batch that
introduces 0, 1, or ≥2 new allergen types. Explicit rules:

- Snapshot prior state **once** before the batch; compute after-state **once**
  after inserting all rows.
- `first` = `priorEntryCount === 0`.
- Determine the **set** of allergen types the meal introduces that were not
  present before (dedupe by type; a meal can carry two foods of one type, or two
  distinct new types).
- `first-allergen`: fires if that set is non-empty; the celebrated allergen is
  chosen **deterministically** (first in `ALLERGENS` declaration order) — accept
  that only one is named in the redirect; a meal introducing two new allergens
  at once is rare.
- `all-allergens`: `afterDistinctAllergens === ALLERGENS.length &&
priorDistinctAllergens < ALLERGENS.length` (recompute distinct count after the
  batch — do **not** reuse the `+1` form).
- categories: recompute `countCategoriesCovered` after the batch.

## History surfaces — where meal cards actually render

The spec's earlier claim that `/foods` hosts a per-event timeline was wrong:
`foods/+page.svelte` renders `bentoFoods` (per-**food** aggregate), and the
loader's per-entry `entries` array is asserted only in tests, never rendered.
The real per-event surfaces are:

1. **Dashboard recent activity** — `RecentFeed.svelte`, fed by `RecentEntry[]`
   from `src/routes/child/[id]/+page.server.ts`. **Primary host.** Group
   consecutive same-`mealId` rows into one meal card here. The loader already
   fetches `limit(20)` and slices to ~5 for display, so grouping needs no larger
   fetch — **group those 20 rows, then slice to ≤5 cards** so a 3-ingredient meal
   is one card, not three feed slots. (A meal straddling the 20-row edge can
   still render partial — low severity on a 5-card feed; accepted.)
2. **Co-parent activity** — `loadCoparentActivity`
   (`src/lib/server/guidance/queries/timeline.ts`, `limit 5`), rendered via
   `CoparentsSection.svelte`, is a **separate** per-event path. It must also
   project `mealId` and run through the same `groupByMeal` helper, else a
   co-parent's 3-ingredient meal shows as 3 near-identical "X a enregistré Y"
   lines.
3. **Report** — `src/routes/child/[id]/report/+page.server.ts` `notable` list.
   **Do NOT group this one.** `notable` is pre-filtered to `reaction !== 'ras'`
   (`report:239`), so grouping would collapse _distinct reacted ingredients_
   (e.g. egg **and** poultry both promoted) into one worst-of line — hiding, at
   the pediatrician-facing surface, exactly the per-ingredient attribution the
   Core Correctness Rule protects. Keep **one line per reacted ingredient**;
   project `mealId` only to annotate membership ("dans un repas"). Grouping is
   for cosmetic feeds; the clinical report stays granular.
4. **GDPR export** — `src/lib/server/gdpr.ts` (explicit column projection, ~
   `:269-279`) must **include `mealId`** so the "full copy of your data" export
   preserves meal structure.

The **per-food carnet** (`/foods`, `aggregateBentoFoods`) intentionally stays
flat: each ingredient is its own food card there (correct for diversification —
it reads by `foodId`, ignores `mealId`). This per-food vs per-meal duality is
by design; document it in code comments.

**Grouping helper:** a small pure function over already-loaded rows that carry
`mealId` — `groupByMeal(rows)` → cards (ingredient list + shared time/texture/
note + worst-of reaction badge) — shared by the **cosmetic per-event feeds**
(dashboard recent + co-parent activity) **only**; the report does not use it.
The client-facing `RecentEntry` / co-parent-entry types (`src/lib/types.ts`)
gain a `mealId` field so the projection reaches the grouping helper.

### Meal card → per-ingredient navigation (the safety loop)

The core safety loop is: baby reacts → open the **specific** food's
reaction-detail page (`src/routes/child/[id]/foods/[entryId]`) → attach a
symptom → that one ingredient's reaction is promoted. So the meal card must list
its ingredients as **individual links to each ingredient's
`foods/[entryId]`**, not just a flat name string. Without this there is no way
to attach a symptom to the right ingredient of a meal — and that is the reason
the app exists. Whole-meal edit/delete is a separate affordance on the card
(next section).

## Edit / delete — extend `log/[entryId]`, no new route

`src/routes/child/[id]/log/[entryId]/+page.server.ts` `load`: fetch the entry;
if `mealId` is null → today's single-entry edit (unchanged). If non-null → load
all siblings (same `mealId`, same `childId`) and enter **meal mode**.

Meal mode needs three actions (today there are only `update`/`delete`):

- **`update`:** a meal-mode schema that does **not** require `foodId`/`customFood`
  (today's `.refine` would reject it). Writes **`givenAt`, `texture`, `notes`**
  once to all siblings (`UPDATE ... WHERE mealId=? AND childId=?`), **plus one
  `reaction` per ingredient** — the form carries a `reaction` field keyed by
  entry id. The reaction write is **dirty-only and optimistically guarded**: for
  each ingredient, issue `UPDATE ... SET reaction=? WHERE id=? AND childId=? AND
reaction=<value-loaded-into-the-form>` **only when that control changed** from
  its loaded value. A date/notes-only edit therefore issues **zero** reaction
  writes, and if a concurrent symptom promotion changed the row after the form
  loaded, the guarded `WHERE` no-ops instead of clobbering the promotion with a
  stale `ras`. (Without the guard, re-writing every reaction each submit would
  widen the app's accepted last-write-wins window to N erasures per submit on the
  one field this whole design exists to protect — `schema.ts:67-72`.) This is the
  single surface where a mis-tapped meal reaction can be corrected, including
  **demoted back to `ras`** (symptom promotion is one-way and `foods/[entryId]`
  has no reaction editor). Bump `updatedAt` on every row actually written.
- **`deleteMeal`:** `DELETE ... WHERE mealId=? AND childId=?`.
- **`removeIngredient`:** delete one sibling row; **then, if exactly one sibling
  remains, null that survivor's `mealId`** so it becomes a standalone entry
  (preserves the single `mealId != null ⇔ meal` invariant; the editor and
  timeline never disagree). Remove-only in v1.

Meal-mode detection loads siblings and treats it as a meal iff **count > 1**;
combined with null-on-shrink this can never see a stale 1-member meal.

The meal card's edit affordance points at `log/<anyMemberEntryId>?from=…`; the
page derives the meal from that entry's `mealId`. `from`-redirect logic
unchanged.

## Allergen safety hint — keyed to never-tried count, not major-allergen count

The guardrail must match the product's one-at-a-time attribution principle and
the menu engine's existing rule. The menu engine (#288,
`src/lib/server/menu/engine.ts`) already **hard-gates un-introduced priority
allergens** so it never suggests two new allergens in a day; the log flow must
not silently contradict that.

Soft, **non-blocking** inline note in the multi-select when the current
selection contains **≥ 2 foods this child has never been given before**, where
**any custom food counts as never-tried** (a homemade galette de sarrasin is
`isCustom` → `allergenType=null`, so an `isMajorAllergen` test is blind to real
allergens — schema.ts:120). Copy conveys "introduce new foods one at a time so a
reaction can be traced," in FR + EN (no anglicism — "nouveaux aliments"), via
the `i18n-add-key` skill.

Data: the log `load` does **not** currently compute introduced foodIds (it
returns only `{ foods }`). Add a small query — the distinct `foodId`s already in
`food_entries` for this child — mirroring the inline one in the menu loader
(`menu/+page.server.ts`), and pass the set as a prop into the multi-select to
flag never-tried selections (any custom/new food counts as never-tried). It's a
new ~4-line query + one prop, not literal reuse of an exported helper.
`isMajorAllergen` stays un-plumbed; the never-tried signal avoids needing it.

Accepted v1 wart: a batch that trips this hint can also fire the "premier
allergène" milestone celebration on success (warn + congratulate). Acceptable —
the hint is advisory and the celebration is real progress; revisit if it feels
contradictory in testing.

## Offline queue

`QueuedSubmit.formData` is `Record<string, string>`
(`src/lib/offline/queue.ts:3`), so multiple `foodId` values collapse to one at
**both** capture (`formObj[key] = value` in `log/+page.svelte`'s `use:enhance`,
lines ~82-93) and replay (`new URLSearchParams(row.formData)`, `queue.ts:115`).
Fixes, all required:

- `QueuedSubmit.formData` → `Record<string, string | string[]>`.
- **Capture** in `+page.svelte`: build the offline object with `getAll`
  semantics for repeated keys (not last-wins `forEach`).
- **Replay** `postOne`: rebuild the body by `append`-ing each array element
  instead of passing the record straight to `URLSearchParams`.
- **Test helper**: `RouteEventOptions.formData` in `src/test/route.ts` is
  `Record<string, string>` and appends one value per key — extend to
  `string | string[]` (loop-append) so batch submissions can be tested
  end-to-end. Existing `Record<string,string>` call sites keep working.

## Edge cases

- **One food selected** in multi mode → `mealId = null`, identical to a single
  entry (no orphan 1-member meals at create time).
- **Same food twice** in one meal → client dedupes selected ids; server dedupes
  resolved ids; partial unique index is the backstop.
- **Meal with 2+ new allergens** → celebrate the first by `ALLERGENS` order;
  `all-allergens` fires only if the batch crosses the distinct-count line.
- **Symptom promotes one ingredient** → that row's reaction escalates; siblings
  unchanged; card badge shows worst-of. A subsequent meal-mode `update` writes
  **each ingredient's own** reaction back to its own row (the promoted row's
  control is pre-filled with the promoted value), so the promotion survives an
  edit unless the parent deliberately changes that specific control — no
  cross-row clobber is possible.
- **Remove down to one ingredient** → survivor's `mealId` nulled → renders and
  edits as a standalone entry.
- **`countNthExposition`** still counts by `foodId` across meals (numerically
  correct); a "3rd time carrot" that was twice blended overstates certainty
  slightly — acceptable, documented, not fixed in v1.
- **Row-limit boundaries** — the feed groups its already-fetched 20 rows then
  slices to ≤5 cards; a meal straddling the 20-row edge can render partial (low
  severity, accepted). The report renders its full window.

## Testing (`bun test`, in-process `:memory:`)

- Multi-select insert **through the real action** (repeated-key FormData, after
  extending the test helper): N rows, one shared `mealId`, shared
  givenAt/texture/notes identical, all reactions equal at create.
- One food in multi mode → `mealId` null.
- **Idempotent replay of a batch** (same Idempotency-Key) inserts once.
- Duplicate food id in one submission → exactly one row for that food.
- Worst-of card badge across a group (ras + reaction → card shows reaction).
- **Symptom promotion isolation** (regression guard for the clobber blocker):
  promoting one ingredient escalates only that row; a following meal-mode
  `update` leaves the promoted row's reaction intact and never writes it onto a
  sibling.
- **Dirty-only reaction write**: a meal-mode `update` that changes only
  date/notes issues **zero** reaction writes; and a guarded reaction write
  no-ops (does not clobber) when the row was promoted after the form loaded
  (stale-form guard).
- Meal-mode `update` writes givenAt/texture/notes once to all siblings; reaction
  is written per-row and only for changed controls — no shared/cross-row reaction
  write.
- **Per-ingredient reaction correction**: meal-mode `update` can set one
  ingredient from `inconfort` back to `ras` without affecting siblings (the
  demote path `foods/[entryId]` cannot provide).
- `deleteMeal` removes all siblings; `removeIngredient` deletes one and nulls the
  survivor's `mealId` when one remains — and that survivor then **loads in
  single-entry mode** (null-on-shrink round-trip).
- Edit-page **meal detection**: loading `log/[entryId]` for a non-null-`mealId`
  entry enters meal mode and loads siblings.
- Milestone redirect for a batch: first food; first allergen (deterministic
  pick); all-allergens finish line crossed by a 2-new-allergen batch; category
  delta.
- Allergen hint fires iff ≥2 never-tried foods selected, including a custom food
  as never-tried (component test).
- FoodCombobox single-select **regression** (prop omitted) unchanged.
- Offline: capture preserves repeated `foodId`; `postOne` replay rebuilds a
  multi-value body; flush of a queued meal inserts all rows.
- Grouping helper: same-`mealId` rows → one card; null-`mealId` rows → plain
  rows; **two distinct meals sharing an exact `givenAt` stay separate and
  ordered by `id`** (deterministic-ordering guard).
- **Report `notable` stays granular**: a meal with two reacted ingredients
  renders two lines (annotated "dans un repas"), not one collapsed card.
- **GDPR export** includes `mealId` for meal members.

## Files touched

- `src/lib/server/db/schema.ts` (+ generated `drizzle/` migration) — `mealId`,
  index, partial unique index.
- `src/lib/components/FoodCombobox.svelte` — `multiple` prop (snippet-extracted).
- `src/routes/child/[id]/log/+page.server.ts` + `+page.svelte` — batch parse/
  insert, multi-select UI, offline capture, allergen hint, milestone rewrite.
- `src/routes/child/[id]/log/[entryId]/+page.server.ts` + `+page.svelte` — meal
  mode: `update` (shared givenAt/texture/notes + per-ingredient reaction),
  `deleteMeal`, `removeIngredient`.
- **`src/routes/child/[id]/+page.server.ts` + `RecentFeed.svelte`** — meal-card
  grouping (primary host); group the already-fetched 20 rows, slice to ≤5 cards.
- **`src/lib/server/guidance/queries/timeline.ts` + `CoparentsSection.svelte`** —
  project `mealId`, secondary `asc(id)` sort, group co-parent activity via
  `groupByMeal`.
- **`src/lib/types.ts`** — `mealId` on `RecentEntry` / co-parent entry types.
- **`src/routes/child/[id]/report/+page.server.ts` + `+page.svelte`** — project
  `mealId`, annotate `notable` lines with meal membership; **do not group**.
- **`src/lib/server/gdpr.ts`** — include `mealId` in the export projection.
- `src/lib/offline/queue.ts` — array-valued form fields.
- **`src/test/route.ts`** — `formData: Record<string, string | string[]>`.
- Shared `groupByMeal` helper (new small module) + a new introduced-foodIds
  query in the log `load` (mirrors the menu loader) for the never-tried hint.
- `messages/en.json` + `messages/fr.json` — allergen hint + meal-card strings.
