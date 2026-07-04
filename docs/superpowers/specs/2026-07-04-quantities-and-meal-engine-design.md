# Quantités & Menu du jour (meal engine)

_Council review: 3 rounds (perspective-diverse Claude agents — correctness / safety / conventions; cross-model roster unavailable in Claude Code). Consensus: sound. Round 1 caught critical safety gaps (no texture/choking caveat, per-food-not-per-allergen reaction avoidance, no forbidden-food guard) and a broken 7-day-rotation guarantee; round 2 caught defects in those fixes (skip-walk repeat, protein frame-mixing, choking name-space mismatch); round 3 caught the orphan-novelty crash (peanut has no meal-role slot). All resolved. Phase 4 seasonality was subsequently cut by the owner; the PRODUCT.md amendment wording (gating Phase 2) remains to confirm._

## Problem

Two gaps a diversifying parent hits daily:

1. **"Combien lui donner ?"** The evidence-based amounts (milk mL/day, protein g/day,
   egg fraction, meal count) already live in the app — but only as prose buried inside
   `STAGES[].focus` / `principles` and `CATEGORY_GUIDANCE[].cadence` in
   `src/lib/content/guidance.ts`. Nothing surfaces a clean per-day / per-meal answer.
2. **"Qu'est-ce que je lui donne à chaque repas ?"** The existing
   `/child/[id]/suggestions` route is a flat list of not-yet-tried foods by age
   (allergens first). It answers "what NEW food could I try next?" — not "what ideas do I
   have for matin / midi / goûter / soir today?". There is no composed day, no protein
   rotation, no repeat-avoidance, no amounts.

The parent persona in `PRODUCT.md` is often anxious and first-time ("I don't know what to
give them"). Both gaps map straight onto that.

## Goals

- **Quantités**: a structured, source-cited per-stage table → a daily-totals card
  ("À 8 mois : ~500 mL de lait · 20 g de protéines · 4 repas") plus rough per-item
  **repères** attached to each menu idea. One source of truth for both.
- **Idées de repas ("Menu du jour")**: a deterministic daily set of meal ideas covering the
  child's stage (matin / midi / goûter / soir), each a set of **ingredients grouped by role**
  (légume, protéine, féculent, matière grasse, fruit/laitage) composed from the child's
  **already-introduced, safe** catalog, each item carrying its **age-appropriate texture / cut
  caveat**, plus **exactly one featured new food per day** and an "allergène du jour".
  Rotation avoids same-slot repeats as far as each role's introduced-safe pool allows (see
  _Rotation_ for the exact, honest guarantee). Personalized by age, logged reactions
  (per-allergen), a strict one-novelty-per-day rule, and dietary exclusions.

## Non-goals

- **No recipes with cooking steps.** A meal idea is ingredients-by-role + a simple label,
  never a written procedure. (Confirmed with owner.)
- **No fabricated French prose.** No grammar-guessing dish-name generator (shipping wrong
  French is a brand regression in this app). The meal label is a **middot-joined ingredient
  list keeping source casing** (`"Courgette · Poulet · Riz"`) — always grammatically safe and
  visually consistent with the totals card. The "meal idea" reads as composed through the
  per-role rows + amounts + textures, not through the title.
- **No LLM / generated content.** The engine is a pure deterministic function over curated,
  source-cited data. See _Product framing_.
- **Menus are suggestions, not prescriptions.** Copy frames every item as a _repère / idée_,
  never "voici ce que Léo doit manger". No authored "dessert course"; the sweet slot is
  labelled "Fruit ou laitage".
- **No persisted menus, no "regenerate" button, no favourites, no shopping list.** YAGNI v1.
- **`/suggestions` is not touched** (but the engine reuses its not-yet-tried query for the
  proactive novelty).
- **No per-food grammage in the `foods` catalog.** Amounts are per role × stage.
- **No nutrition / calorie tracking.**
- **Custom (per-child) foods are not used for composition** in v1 — only built-in seeded
  rows. This non-goal is **load-bearing for safety**: honey and other custom-only entries
  never reach a menu because customs are excluded.

## Product framing & required PRODUCT.md amendment

`PRODUCT.md` lists "AI-generated meal plans" under **Anti-user**, "AI-generated SaaS
template … Reject on sight" under **Anti-references**, and principle 8 is "We curate; we don't
opine." A generated daily menu brushes against all three. The owner asked for this feature
directly, so the concept is blessed — but to keep the vision legible, a short PRODUCT.md
amendment must carve out the accepted shape:

> A **deterministic, source-cited daily _meal-idea_ surface** — composed only from the curated
> catalog, framed as _repères_ not prescriptions, LLM-free and telemetry-free — is an
> extension of the accepted `/suggestions` surface, distinct from the rejected "AI-generated
> meal plans" (non-deterministic, cloud, authored-content plans).

**This amendment is a precondition for Phase 2 (the engine), authored during Phase 1.**
Phase 1 (Quantités) does not depend on it and **ships regardless** of whether the wording
lands; the amendment gates only the engine. If it is not acceptable, that is a **go/no-go** to
escalate before building Phase 2. The framing choices above (suggestive copy, no authored
prose, no dessert "course") exist to stay inside the carve-out.

## Delivery phases

The safe, high-value half (Quantités) has zero dependency on the higher-risk half (the
engine). One spec, phased PRs:

- **Phase 1 — Quantités.** `quantities.ts` + `QuantitiesCard` + the PRODUCT.md amendment. No
  engine, no schema change, no rotation. Uncontroversial (cited guidance).
- **Phase 2 — Menu engine core + safety.** `engine.ts` + `/menu` route + `MenuDay`, with
  **all safety guards from §Safety wired in from the start** (never a follow-up): age gating,
  forbidden-foods, per-allergen reaction avoidance, texture/choking caveats, the one-novelty
  rule, unified allergen-of-the-day.
- **Phase 3 — Dietary exclusions.** `children.dietaryExclusions` migration + settings toggles.

_(Phase 4 "seasonality" was considered and **cut** by the owner: a food→months map that must
track the catalog for a soft boost that never blocks — lowest value, highest drift-maintenance.
The other inputs personalize the menu sufficiently.)_

## Surfaces

1. **New route** `/child/[id]/menu` — title **"Menu du jour"**, framed as ideas.
2. **New tile** "Idées de repas" on the Aujourd'hui bento, lilac.
3. **Bottom-nav**: fold `menu` into the **Découvrir** matcher in `BottomNavBento.svelte`
   (currently `guide|suggestions|sources` → add `menu`) so the tab shows active on `/menu`.
   **No 5th tab.** Add a `/menu`→Découvrir-active nav test (existing `BottomNavBento.test.ts`
   only asserts positive matches, so the regex change breaks nothing).
4. **`/child/[id]/settings`** gains **dietary-exclusion** toggles (Phase 3).

## Data model

One additive schema change (Phase 3); everything else derives.

```ts
// children
dietaryExclusions: text('dietary_exclusions', { mode: 'json' })
  .$type<DietExclusion[]>()
  .notNull()
  .default(sql`'[]'`);
```

- Byte-for-byte the shape of `passkeys.transports` (`schema.ts:200-203`), which migrates
  cleanly; `drizzle-kit` emits `ALTER TABLE children ADD dietary_exclusions text DEFAULT '[]'
NOT NULL;` and SQLite backfills from the default — **no data-migration script** needed.
- `DIET_EXCLUSIONS = ['porc', 'vegetarien', 'sans_poisson'] as const` in a new **pure** module
  `src/lib/utils/diet.ts` (no Svelte/lucide import, mirroring `reaction-values.ts`, so
  `drizzle-kit` can load `schema.ts`). `vegetarien` excludes `viandes` + `poissons`;
  `sans_poisson` excludes `poissons`; `porc` excludes by name-matcher (`Porc`, `Jambon`).
- **Validation app-layer only** (SQLite can't CHECK JSON): `?/setDiet` validates against
  `DIET_EXCLUSIONS` and drops unknowns **on write**; the loader coerces malformed/null to `[]`
  **on read**. Both halves required.
- Writes go through last-write-wins `children.updatedAt`. **Open:** `setDiet` member-allowed
  (proposed default — co-parents set caregiving info) vs `requireOwnership`.

No menu is ever persisted.

## Safety guards (highest priority — all reuse existing curated content)

The engine **actively recommends** meals, so `suggestedAgeMonths` alone is insufficient (it
encodes developmental readiness only). Every guard reuses content that already exists. These
are Phase-2 acceptance criteria, not follow-ups.

1. **Forbidden-food & unsafe-preparation filter.**
   - **Step 0** hard filter: drop any candidate `FORBIDDEN_FOODS` gates at the child's age,
     iterating `nameMatchers` + `untilMonths` (covers numeric-gated items; honey/soja are
     already unreachable via `suggestedAgeMonths` + the customs non-goal).
   - **Charcuterie**: `Jambon blanc` is removed from the composable `protéine` pool by an
     **age-independent** name-matcher (`Jambon`) — kept catalog-loggable but never composed.
     Do **not** give `FORBIDDEN_FOODS.sel` an `untilMonths` (it would re-admit Jambon at
     ≥12 mo); charcuterie stays out at all ages (`STAGES['12-36'].redFlags`).
   - **Raw-milk cheese**: rather than rename seed rows, attach a **"au lait pasteurisé"
     caution** to every soft/fresh-cheese menu item (`Camembert`, `Chèvre frais`,
     `Brebis (fromage)`) via the curated caution map (below). This covers all three uniformly
     (`FORBIDDEN_FOODS.lait-cru`, `ALLERGEN_GUIDANCE.lait` exception for comté/emmental) and
     avoids a seed rename. _(Council note: renaming via `applySeedCorrections` would in fact be
     DB-safe — the insert is gated on `total === 0`, so on a live DB only the in-place UPDATE
     runs and FKs are by `food_id` — but the caution is feature-scoped and covers all three
     cheeses without app-wide seed churn, so it is preferred.)_
2. **Texture / choking caveat per item — via a curated map, not string-matching.** `MenuItem`
   gains `texture: string` and `caution: string | null`. `texture` = `STAGES[stageId].textures`
   (or the age-keyed `TEXTURE_PROGRESSION` step). **Crucially**, seed names do NOT equal
   `CHOKING_HAZARDS[].food` keys (seed `Tomate` / `Raisin (coupé en 4)` / `Carotte` / `Pomme`
   vs hazard keys `Tomate cerise` / `Raisin` / `Carotte crue, pomme dure`), so a string match
   silently misses the dangerous items. Instead add a **curated `CHOKING_BY_FOOD: Record<
seedFoodName, ChokingRule>`** map (or a `choking` tag on seed rows) with a **drift test**
   (every key ∈ `FOODS_SEED`), same machine-checkable pattern as `FORBIDDEN_FOODS`. `caution`
   also carries "sans arêtes" for `poissons` and "haché / petits morceaux fondants" for
   `viandes` (`KEY_PRINCIPLES.cook-thoroughly`), and the soft-cheese "au lait pasteurisé" from
   Safety 1. `MenuDay` renders `STAGES[stageId].redFlags` once per day.
3. **Per-allergen reaction avoidance.** Derive
   `reactedAllergens = { food.allergenType : food ∈ avoidFoodIds, allergenType != null }`.
   - **`reaction` tier** (worst = `reaction`): the slot filter drops **every** candidate whose
     `allergenType ∈ reactedAllergens` (a Saumon reaction blocks Cabillaud and all `poisson` —
     cross-reactivity). **`inconfort` tier**: per-food drop only.
   - `allergenFocus` **excludes `reactedAllergens` in both modes** (`ALLERGEN_GUIDANCE.whatToDo`,
     `REACTION_GUIDANCE.reaction.whatToDo`).
4. **One featured new food per day, enforced structurally.** Non-novelty slots draw **only from
   introduced-safe foods** (see §Rotation), so they can never surface a new food. Exactly one
   proactive novelty is featured (§Novelty). `allergenFocus.introduce` **is** that novelty when
   a priority allergen is due; `allergenFocus.maintain` must re-offer an **already-introduced**
   food (`food ∈ introducedFoodIds`) — never a new food (closes the covert-second-novelty path
   where "maintain lait" could pick a brand-new Camembert). Result: at most one `isNew` per day.
5. **`allergenFocus` respects dietary exclusions.** `PRIORITY_INTRODUCTION_ALLERGENS` includes
   `poisson`; a `sans_poisson`/`vegetarien` family must never see "Allergène du jour : poisson".
   Apply exclusions + `reactedAllergens` before rotating the focus.
6. **Nut-oil never in the silent fat slot.** `Huile de noix` (`fruits_a_coque`) is excluded
   from the `matière grasse` role; only `Huile d'olive`/`Huile de colza` rotate there.
7. **Amounts are _repères_, not targets.** `amountHint` renders with indicative framing + the
   `KEY_PRINCIPLES.satiety` caveat once per menu, and the totals card surfaces
   `QUANTITIES[stage].sources`.
8. **Age gating with correct branch order.** The engine branches on **raw `ageMonths` first**:
   - `ageMonths < 4` → **zero solids**, milk-primary message only (do not list any food).
     This branch must run **before** the stage lookup, because `getStageForAgeMonths(3)` clamps
     to `'4-6'` and would otherwise leak a solid.
   - stage `4-6` (`4 ≤ ageMonths < 6`) → **a single** suggested food under the milk banner, not
     a multi-slot day (`STAGES['4-6']`: "Une nouvelle saveur à la fois").
     Both claims get explicit regression tests (`<4 mo` menu has zero items; `4-6` has one).

## New content — `src/lib/content/quantities.ts` (Phase 1)

```ts
export type StageQuantities = {
  stageId: StageId;
  milkPerDay: string;
  meals: number;
  proteinPerDay: string;
  eggFraction: string | null;
  fishPerWeek: string;
  portions: {
    legume: string;
    fruit: string;
    feculent: string;
    laitier: string;
    matiereGrasse: string;
  };
  notes: string[];
  sources: SourceId[];
};
export const QUANTITIES: Record<StageId, StageQuantities>;
export function getQuantitiesForStage(stageId: StageId): StageQuantities;
```

| Stage   | Lait        | Repas | Protéine/j          | Œuf   | Poisson              |
| ------- | ----------- | ----- | ------------------- | ----- | -------------------- |
| `4-6`   | ~600–800 mL | 2\*   | premières vers 6 m  | —     | —                    |
| `6-9`   | ~500 mL     | 4     | 10–20 g (1×)        | ¼     | 2×/sem. dont un gras |
| `9-12`  | ~500 mL     | 4     | 20–30 g (1×) †      | **¼** | 2×/sem. dont un gras |
| `12-36` | ~500 mL     | 4     | 30 g → 50 g à 3 ans | ⅓–½   | 2×/sem. dont un gras |

\* `4-6`: milk-primary; single emerging solid (Safety 8). † `9-12` protein interpolated —
**source-confirm against `spf-pnns-guide` at plan time.** **Egg `9-12` = ¼** (⅓ begins _après
1 an_ per `ALLERGEN_GUIDANCE.oeuf`).

## The engine — `src/lib/server/menu/engine.ts` (Phase 2)

Pure, DB-free, Svelte-free. Deterministic function of its inputs.

```ts
export type MenuInput = {
  childId: number;
  ageMonths: number;
  dayIndex: number; // canonical Europe/Paris civil-day ordinal (see Timezone)
  weekday: number; // 0=Mon..6=Sun, from the same Paris date
  catalog: Food[]; // built-in rows only
  introducedFoodIds: Set<number>;
  avoidFoodIds: Set<number>; // per-food, worst reaction >= 'inconfort'
  reactionTierFoodIds: Set<number>; // subset whose worst reaction == 'reaction'
  introducedAllergens: Set<string>;
  reactedAllergens: Set<string>;
  dietaryExclusions: DietExclusion[];
};
export type MenuItem = {
  role: RoleId;
  food: Food;
  amountHint: string | null;
  texture: string;
  caution: string | null;
  isNew: boolean;
  allergenType: string | null;
};
export type Meal = { id: MealId; label: string; items: MenuItem[] };
export type Menu = {
  stageId: StageId;
  quantities: StageQuantities;
  textures: string;
  redFlags: string[];
  meals: Meal[];
  allergenFocus: { food: Food; mode: 'introduce' | 'maintain' } | null;
  noveltyFoodId: number | null;
};
export function buildMenu(input: MenuInput): Menu;
```

### Filtering & rotation — over the compacted **introduced-safe** list (fixes F1/F2/NEW-1/F8)

Round-1's "fixed universe, skip-don't-remove" was wrong: a positional walk that skips filtered
entries repeats whenever the start index lands on a skipped slot, and it contradicted itself
(skip = membership vs "tie-order, never remove"). Corrected, simpler model:

1. Per slot, `safe` = role foods that are age-eligible ∩ ¬forbidden ∩ ¬dietExcluded ∩
   ¬reaction-blocked (per-food for `inconfort`, per-allergen for `reaction`), sorted
   canonically by `food.id`.
2. `base` = `safe ∩ introducedFoodIds` (the **introduced-safe** list) — "prefer introduced" is
   honest **membership**, single-meaning, not a vague tie-order.
3. **Pick** = `base[(dayIndex + (H(slotKey) >>> 0)) % base.length]` with the double-mod guard
   (`((x % n) + n) % n`, like `pickRotatingTip`, `guidance.ts:1050`), FNV-1a `H` forced
   unsigned, ties broken by `food.id` (total comparator → input-order-independent). Indexing
   the **compacted** list means consecutive days pick adjacent entries → **no consecutive-day
   repeat while `base.length ≥ 2`**. On the rare day `base` changes size (a new food
   introduced, a reaction logged) a single repeat is possible — far milder than the skip-walk
   runs, and disclosed.
4. `base.length === 0` (role has no introduced-safe food yet) → the slot renders a gentle
   **"À découvrir : un [role]"** prompt linking to `/suggestions` (not a blank). `=== 1` → that
   food daily (acknowledged, not "non-repeat").

### `midi` protéine — weekday category + stride-1 occurrence rotation (fixes F4/a)

The `midi` protéine category is `PROTEIN_WEEK[weekday]` (guarantees fish 2×/sem incl. one gras
across any 7 residues). Within that category, rotate the introduced-safe-in-category list by an
**occurrence counter computed in the single Monday-origin frame**:
`occ(cat) = |{ d' ≤ dayIndex : PROTEIN_WEEK[weekday(d')] === cat }|`, `pick = baseCat[occ %
len]`. Computing `occ` end-to-end in the Monday frame (not `floor(dayIndex/7)` epoch/Thursday
blocks) makes a category's successive appearances stride by exactly 1, so a small category
(k=3) never repeats on consecutive appearances. A stride-1 test guards this even though today's
protein pools (k ∈ {2,5,7,8}) don't hit the k=3 case. **Degenerate case**: `vegetarien` /
`sans_poisson` collapse every protein weekday to the fallback pool `{legumineuses, oeufs}`,
rotated by `dayIndex` (the per-category key model degenerates to one pool — specified, tested).

### Novelty — one **proactive** new food per day, on the surface that fits (fixes F3/b, orphan-novelty)

1. Choose the day's single novelty **proactively** (not by scavenging slot picks): if a
   not-yet-introduced, non-reacted, dietary-allowed **priority allergen** is due → it is both
   `allergenFocus.introduce` and `noveltyFoodId`. Else pick the next not-yet-tried, age-eligible,
   safe food **from role-bearing categories only** (below), in the `/suggestions` ordering,
   rotated by `dayIndex` so it changes daily. Discovery stays alive **even after every role has
   an introduced food** (no reactive stall).
2. **Render the novelty on the surface that fits its category — this is the orphan-novelty fix.**
   `allergenes` (beurre de cacahuète=arachide, purées d'amande/noisette/cajou + role-excluded
   `Huile de noix`=fruits_a_coque, tahin=sésame) and `aromates` have **no meal-role pool**, so a
   novelty from them cannot be "placed in a slot":
   - **Priority allergen due** → surface it in the dedicated **"Allergène du jour"** card
     (`allergenFocus.introduce`) with the guidance `howToOffer` hint. If it is _also_ role-bearing
     (`oeuf`→oeufs, `lait`→laitier, `gluten`→féculent, `poisson`→poissons) it may additionally
     fill its meal slot; the **orphan allergens (arachide, sésame, fruits*a_coque) are surfaced
     \_only* in the card**. Either way it is the day's one novelty — no separate meal novelty is
     added. This is the marquee early-peanut path and must not crash.
   - **Non-allergen novelty** is drawn **only from role-bearing food categories** (legumes,
     fruits, feculents, legumineuses, viandes, poissons, oeufs, produits_laitiers,
     matieres_grasses); `allergenes`, `aromates`, and `Huile de noix` are **excluded from the
     proactive-novelty pool** (aromates are seasonings, not a dish to "introduce"). It fills one
     meal slot of its role, badged "Nouveauté".
3. **Multi-slot placement tiebreak:** a role appearing in more than one meal (légume → midi+soir;
   fruit → matin+goûter+dessert) gets the meal-slot novelty in the **earliest meal of the day**
   for that role ("une nouveauté en début de repas", `TIPS.one-novelty`); its other slots keep
   their introduced-safe base pick.
4. Every **other** slot stays on its introduced-safe base pick (or the "à découvrir" prompt).
   Non-novelty slots draw only from introduced foods, so **no second new food can appear**.
5. **Intra-day dedup** runs over the introduced-safe base picks only (never the novelty) and
   bumps a food appearing in >1 slot to the **next introduced-safe entry** — so dedup can never
   introduce a new food; a slot with no alternative yields to the "à découvrir" prompt.

### Timezone & weekday (fixes F5/F6, + DST conditions)

`dayIndex`/`weekday` derive from the instant formatted to a **Europe/Paris civil date** via
`Intl.DateTimeFormat`, computed **server-side in the loader** (so two co-parent devices in
different OS zones can't diverge). The `YYYY-MM-DD → ordinal` step must treat it as a **plain
civil date** (parse at UTC-midnight or map y/m/d → day-number) and **must not re-apply a tz
offset** (a hand-rolled `Date.now() + (+1/+2h)` breaks twice a year). DST is otherwise safe:
the civil date flips at local midnight; spring-forward skips 02:00–03:00 and fall-back repeats
it, neither touching midnight. `weekday` is Monday-origin (`(dayIndex + 3) % 7`, since epoch
day 0 is a Thursday), used for `PROTEIN_WEEK`. Menu flips at Paris local midnight; co-parents
agree (same instant → same civil date).

## Rotation guarantee (honest statement)

> Within a role, **no consecutive-day repeat while the introduced-safe pool has ≥ 2 foods and
> is unchanged**; on the rare day that pool changes (a food newly introduced, a reaction
> logged) a single repeat is possible. The pool **grows as the child diversifies**, so variety
> improves over time; early on, few safe foods mean necessary (and developmentally correct)
> repetition. Plus **one new food is featured every day** until the age-appropriate catalog is
> exhausted.

Age-eligible **ceilings** (from `FOODS_SEED`) that the introduced-safe pool grows toward:

| Role           | @ 6 mo | @ 9 mo | Note                                                   |
| -------------- | ------ | ------ | ------------------------------------------------------ |
| légume         | ~19    | ~24    | large                                                  |
| fruit          | ~14    | ~18    | large                                                  |
| féculent       | 8      | 8      | thin — one reaction can drop < 7; disclosed            |
| laitier        | 4      | 9      | < 7 at 6–8 mo → dairy may repeat every ~4 days         |
| matière grasse | 2      | 2      | nut-oil excluded → alternates 2 oils; fats are routine |
| protéine (cat) | 2–8    | 2–8    | per weekday category; occurrence-strided               |
| dessert/sweet  | ~18    | ~27    | fruits ∪ laitiers                                      |

Vegetarian protein (legumineuses ∪ oeufs) is 4 at 6 mo, 6 at 8 mo — < 7 until Tofu at 36 mo;
disclosed, not promised. Small pools are a data reality; copy never claims variety the catalog
can't provide.

## Data flow

```text
child.birthDate ─▶ ageInMonths ─▶ (ageMonths<4? no solids) ─▶ getStageForAgeMonths ─▶ stageId
now ─▶ Europe/Paris civil date ─▶ dayIndex + weekday(Mon-origin)
foods(built-in) ─▶ per role: age ∩ ¬forbidden ∩ ¬diet ∩ ¬reaction ─▶ safe ─▶ ∩ introduced ─▶ base
food_entries(childId) ─▶ introducedFoodIds, introducedAllergens
food_entries⋈foods worst reaction(REACTION_RANK) ─▶ avoidFoodIds, reactionTierFoodIds, reactedAllergens
child.dietaryExclusions ; not-yet-tried(/suggestions order) ─▶ proactive novelty
        └────▶ buildMenu ─▶ Menu (textures, cautions, one novelty, à-découvrir prompts)
                     ▲  QUANTITIES · PROTEIN_WEEK · FORBIDDEN_FOODS · CHOKING_BY_FOOD
```

## Route loader — `src/routes/child/[id]/menu/+page.server.ts`

Mirrors `suggestions/+page.server.ts`: `requireChildContext`; `child` from `parent()`;
`ageInMonths`. Queries the introduced sets, the reaction sets (grouped by worst `reaction` rank
via `REACTION_RANK`, projecting `allergenType`), the age-eligible built-in catalog, the
not-yet-tried list (reused from suggestions), and `child.dietaryExclusions` (coerced `[]` on
malformed). Computes `dayIndex`/`weekday` from the Paris civil date with an **injectable
`now?: number`** for tests — precedent is `now?: number` in `reminders.ts:43` (not
`loadBentoAllergens`, which has no such param). Calls `buildMenu`. No writes. Canonicalize every
`Set`-derived list (sort by `food.id`) before any "pick first", since the suggestions
`introducedIds` query has no `ORDER BY`.

## Components

- **`MenuDay.svelte`** — one card per meal; role rows with category icon/tint, `amountHint` as
  an indicative caption, `texture`/`caution` per item, a single "Nouveauté" `Badge` + tip,
  empty roles as an "À découvrir … voir les suggestions" prompt, the middot label as title,
  `redFlags` + satiety caveat once. Items link to `/child/{id}/log?foodId={id}`.
- **`QuantitiesCard.svelte`** (Phase 1) — totals from `QUANTITIES[stage]` + surfaced `sources`.
- **Aujourd'hui tile** → `/menu`. **Settings** (Phase 3) — toggle group + `?/setDiet`.

## i18n

Chrome via paraglide FR + EN, **flat camelCase keys** (the repo has zero dotted keys; dotted
keys break paraglide codegen). Content data (`QUANTITIES`, food names) stays FR-only
in `.ts` (the `guidance.ts` precedent).

| Key                                                     | FR                                                         | EN                                           |
| ------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `menuTitle`                                             | Menu du jour                                               | Today's ideas                                |
| `menuSubtitle`                                          | Des idées pour composer les repas de {name}                | Meal ideas for {name}                        |
| `menuMealMatin`/`Midi`/`Gouter`/`Soir`                  | Matin / Midi / Goûter / Soir                               | Morning / Midday / Afternoon snack / Evening |
| `menuRoleLegume`/`Proteine`/`Feculent`/`MatiereGrasse`  | Légume / Protéine / Féculent / Matière grasse              | Vegetable / Protein / Starch / Fat           |
| `menuRoleDessert`/`Laitier`                             | Fruit ou laitage / Laitage                                 | Fruit or dairy / Dairy                       |
| `menuNovelty`                                           | Nouveauté                                                  | New food                                     |
| `menuNoveltyHint`                                       | Une nouveauté à la fois, en début de repas.                | One new food at a time.                      |
| `menuAllergenOfDay`                                     | Allergène du jour                                          | Allergen of the day                          |
| `menuMilkPrimary`                                       | Le lait reste le repas principal à cet âge.                | Milk is still the main meal at this age.     |
| `menuDiscoverSlot`                                      | À découvrir : un {role} — voir les suggestions             | Discover a {role} — see suggestions          |
| `menuSatiety`                                           | Ce sont des repères : ne jamais forcer.                    | These are guides — never force.              |
| `quantitiesHeading`                                     | Combien lui donner ?                                       | How much to give?                            |
| `quantitiesMilk`/`Meals`/`Protein`                      | Lait / Repas / Viande · poisson · œuf                      | Milk / Meals / Meat · fish · egg             |
| `settingsDietHeading`/`Porc`/`Vegetarien`/`SansPoisson` | Régime alimentaire / Sans porc / Végétarien / Sans poisson | Diet / No pork / Vegetarian / No fish        |

(FR uses « », en-dash –, curly apostrophes; all values audited anglicism-free.)

## Personalization inputs

| Input               | How applied                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| Age-appropriateness | Hard filter + stage template + `<4`/`4-6` degradation (Safety 8).      |
| Forbidden foods     | Hard filter step 0 + charcuterie pool-exclusion + soft-cheese caution. |
| Logged reactions    | Per-food (`inconfort`) or per-allergen (`reaction`) hard filter.       |
| One-novelty rule    | Non-novelty slots are introduced-only; exactly one proactive novelty.  |
| Dietary exclusions  | Hard filter by category / name-matcher, applied to focus too.          |

## Error handling / edge cases

- `ageMonths < 4`: zero solids, milk message only (Safety 8, branch-first).
- Role with no introduced-safe food: "à découvrir" prompt, never blank, never a silent novelty.
- `dietaryExclusions` null/malformed: coerce `[]`; unknown tags dropped on write and read.
- Reaction sets empty / clock skew / future entries: `dayIndex` stays a deterministic integer.
- New account: mostly "à découvrir" prompts + one novelty — sparse by design, fills in as the
  child diversifies (points the parent at what to introduce next).
- Co-parents: derived (no writes) ⇒ no conflict; both agree via the Paris civil date.

## Testing (TDD, `bun:test`)

`engine.test.ts`:

- determinism — same inputs ⇒ deep-equal; **shuffled `catalog`/Set input order ⇒ identical
  output** (guards the total comparator).
- no consecutive-day repeat while introduced-safe ≥ 2; **churn case** — after logging today's
  pick and a reaction to an unrelated food, tomorrow still differs where the pool allows; the
  single-repeat-on-pool-change day is acknowledged.
- introduced-only non-novelty slots — a not-yet-introduced food never appears outside the
  novelty; empty role → "à découvrir" prompt.
- one novelty — ≤1 `isNew`/day across many seeds and account ages; `allergenFocus.introduce` ⇒
  it **is** the novelty; `allergenFocus.maintain.food ∈ introducedFoodIds`; **proactive** —
  a fully-introduced day still features a new food (no stall); dedup never yields a 2nd new
  food (the `{Pomme}`-only fruit/dessert case).
- **orphan-novelty** — when the due priority allergen is arachide / sésame / fruits_a_coque
  (category `allergenes`, no meal role), the novelty renders **only in the "Allergène du jour"
  card** and the build does not throw (the early-peanut path); an `aromates` food is never the
  featured meal novelty; a role-bearing allergen (œuf/lait/gluten/poisson) may appear in both
  the card and its slot but still counts as the single novelty.
- **multi-slot placement** — a novelty légume lands in `midi` (not `soir`); a novelty fruit in
  `matin` (earliest), the role's other slots keep their base pick.
- forbidden/charcuterie/cheese — no `FORBIDDEN_FOODS` item at gated age; Jambon never a
  protéine at any age; Camembert/Chèvre frais/Brebis carry "au lait pasteurisé".
- **choking map** — `CHOKING_BY_FOOD` keys ∈ `FOODS_SEED` (no orphans); **completeness** — the
  known choke-relevant seed foods (`Tomate`, `Raisin (coupé en 4)`, `Carotte`, `Pomme`,
  `Concombre`, `Poivron`, `Salade verte`) each have an entry so a future hazardous food isn't
  silently uncaptioned; poisson "sans arêtes"; viandes "haché".
- per-allergen avoidance — `reaction` to Saumon blocks all `poisson`; `inconfort` blocks only
  Saumon; `allergenFocus` never a `reactedAllergen` nor an excluded allergen (`sans_poisson`).
- protéine — weekday category schedule; fish ≥2×/one-gras over 7 consecutive days; stride-1
  occurrence rotation (synthetic k=3 category never repeats on consecutive appearances);
  vegetarian fallback pool.
- timezone — Monday-origin `weekday`; menu flips at Paris local midnight (inject `now` at 23:30
  & 00:30 Paris, incl. a DST-transition date); civil-date ordinal takes no tz re-offset.
- pick-formula safety — unsigned hash (no negative index); empty base short-circuits (no %0);
  `base.length === 1` returns the same food without throwing.
- age branch — `<4 mo` menu has **zero** items; stage `4-6` has exactly one.

`quantities.test.ts` — every `StageId`; egg `9-12` == "¼"; real `SourceId`s.
`menu/+page.server.test.ts` — loader wires the introduced/avoid/reactedAllergen/exclusion sets

- injects `now`.
  `settings` action test — exclusions persist + validate (unknown rejected).
  Assert the **empty-slot / à-découvrir** and **novelty-cap** branches
  explicitly (the coverage gate in `scripts/bun-test.ts` counts these `.ts` modules).
  `MenuDay`/`QuantitiesCard` `.svelte` smoke tests. Add a `/menu`→Découvrir-active nav test.

## Sources

Amounts trace to existing `SourceId`s (`spf-pnns-guide`, `hcsp-2020`, `anses-nourrisson`,
`espghan-2017`, `1000-jours`). `9-12` protein interpolation to confirm against
`spf-pnns-guide`.

## Resolved during exploration

- `pickRotatingTip` (`guidance.ts:1047`) reused **with corrections** (Paris tz vs its UTC
  boundary; its double-mod guard kept).
- `REACTION_RANK` (`reaction-values.ts:12`): avoid = rank ≥ `inconfort`; `reaction` tier
  escalated to allergen level (Safety 3).
- `/suggestions` supplies the introduced-foods / introduced-allergens /
  `PRIORITY_INTRODUCTION_ALLERGENS` / not-yet-tried queries; its `introducedIds` query has no
  `ORDER BY` → the engine canonicalizes by `food.id`.
- Schema/migration safe vs `passkeys.transports` (`schema.ts:200-203`); `food_entries` FK is by
  `food_id` (`schema.ts:150-152`), no denormalized name — so any future seed rename would keep
  history, though we avoid renames here.
- `seedFoods` insert is gated on `total === 0` (`seed.ts`); `applySeedCorrections` always runs
  (the Tofu-age idiom) — relevant only if a data correction is ever needed.
- Injectable-time precedent is `now?: number` (`reminders.ts:43`).
- Bottom-nav matchers in `BottomNavBento.svelte`; Découvrir owns `guide|suggestions|sources`.

## Council review — rounds 1–3 addressed

**Round 1** — safety S1 texture/choking, S2 per-allergen avoidance, S3 forbidden foods, S6/S7
amounts (→ §Safety, §Quantités); correctness F1–F8 (→ §Engine); conventions C3 flat keys, C4
phasing + no fabricated prose + seasonality-last, C5 Découvrir nav, C6 `now` citation; P1
product framing.
**Round 2** — the rotation rewrite's own defects: **NEW-1** (skip-walk didn't guarantee
no-consecutive-repeat + self-contradiction) → compacted introduced-safe rotation; **(b)**
dedup/novelty ordering + reactive stall → proactive novelty, introduced-only dedup; **(a)**
protein frame-mixing → single-frame stride-1 occurrence; **NEW-2** choking name-space mismatch
→ curated `CHOKING_BY_FOOD` map + drift test; **N1** Chèvre/Brebis → uniform soft-cheese
caution; **N2** maintain-as-second-novelty → `maintain ∈ introduced`; **N3** `<4 mo` branch
order + tests; DST conditions pinned; middot label; amendment gates Phase 2.
**Round 3** — one residual: the **orphan-novelty** crash — arachide/sésame/fruits_a_coque (and
aromates) have no meal-role pool, so unifying them into a meal-slot novelty was undefined for
the marquee early-peanut case. Fixed: allergen/orphan novelties render in the "Allergène du
jour" card; meal-slot novelties are restricted to role-bearing categories; multi-slot tiebreak
= earliest meal. Correctness member confirmed NEW-1/(a)/NEW-2 resolved and the rest sound; a
non-blocking choking-map completeness assertion was added. No material flaws remain.

## Open questions for the plan

- `9-12` protein grammage — source-confirm against `spf-pnns-guide`.
- `setDiet` — member-allowed (proposed) vs `requireOwnership`.
- `PROTEIN_WEEK` exact Monday-origin ordering (any 7-day sequence with fish 2×/one-gras).
