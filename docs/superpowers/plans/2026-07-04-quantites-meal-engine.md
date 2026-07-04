# Quantités & Menu du jour Implementation Plan

_Council review: passed (2 rounds). R1 fixed: weekday `+3`, introduced-only `pickProtein`, insert-not-replace novelty (`placeNovelty`), loader row-cast, charcuterie/pork matcher split, choking-map berries, per-allergen reaction. R2 caught & fixed: the charcuterie (Jambon) leak through `catalogSafe` into a badged protein novelty, plus per-task import hygiene (`no-unused-vars` is `error`). Engine logic otherwise verified clean by both reviewers._

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-stage quantity guidance and a deterministic daily "Menu du jour" meal-idea engine to the diversif baby-food tracker.

**Architecture:** Pure, source-cited content modules (`quantities.ts`) + a pure, DB-free engine (`engine.ts`) that composes a day of meal ideas from the child's **introduced-and-safe** catalog, rotating each slot over its compacted introduced list, featuring exactly one proactive new food/day (on the "Allergène du jour" card or a meal slot), and attaching age-appropriate texture/choking/forbidden-food safety caveats. A SvelteKit route (`/child/[id]/menu`) loads DB state and calls the engine; a JSON column on `children` stores dietary exclusions.

**Tech Stack:** Bun + SvelteKit (Svelte 5 runes) on `svelte-adapter-bun`, `bun:sqlite` + Drizzle, `bun:test`, paraglide i18n (FR default + `/en/`).

## Global Constraints

_Every task's requirements implicitly include this section._

- **Use Bun, never npm/Node.** `bun install`, `bun run X`, `bun test`. Prefix Node-shebang tools with `bun --bun` (drizzle-kit, vite, svelte-check).
- **French UI, zero anglicisms.** New user-facing strings go through paraglide (FR + EN parity) using the **`i18n-add-key` skill**. Keys are **flat camelCase** (`menuTitle`) — the repo has zero dotted keys; dotted keys break paraglide codegen. FR copy uses « », en-dash `–`, curly apostrophe `’`.
- **Content data stays FR-only in `.ts`** (the `guidance.ts` precedent) — `QUANTITIES`, `CHOKING_BY_FOOD`, food names.
- **Pre-commit** husky runs `lint-staged` (prettier + eslint). Do **not** bypass with `--no-verify`.
- **Tests** are `bun:test` against in-process `bun:sqlite` `:memory:` (see `src/test/db.ts`). Coverage gate lives in `scripts/bun-test.ts` and counts new `.ts` modules (`.svelte` excluded).
- **Determinism:** the engine is a pure function of its inputs; `Date.now()` / `Math.random()` / `new Date()` are **not** called inside the engine — the loader passes `dayIndex`/`weekday`. Never introduce randomness.
- **Safety guards are Phase-2 acceptance criteria, not follow-ups.** Reuse existing curated content (`FORBIDDEN_FOODS`, `CHOKING_HAZARDS`, `STAGES[].textures/redFlags`, `ALLERGEN_GUIDANCE`); author no new medical claims.
- **After code changes** run `graphify update .` (AST-only, no API cost) before the final commit of each phase.
- **Resolved open questions** (use these values verbatim):
  - `PROTEIN_WEEK` (Monday-origin, index 0 = Mon): `['viandes','poissons','legumineuses','oeufs','poissons','viandes','legumineuses']`, with the index-1 poisson day preferring an oily fish (`Saumon`/`Sardine`/`Maquereau`/`Truite`). → 2 fish/week incl. 1 oily.
  - `setDiet` authorization: **member-allowed** via `requireChildContext` (co-parents set caregiving info), not `requireOwnership`.
  - `9-12` protein: `'20–30 g/j'` — **verify against `spf-pnns-guide` during Task 1**; if the source states a narrower band, use it.

---

## Phase 1 — Quantités (ships alone; no engine, no schema)

### Task 1: `quantities.ts` content module

**Files:**

- Create: `src/lib/content/quantities.ts`
- Test: `src/lib/content/quantities.test.ts`

**Interfaces:**

- Produces: `type StageQuantities`, `const QUANTITIES: Record<StageId, StageQuantities>`, `function getQuantitiesForStage(stageId: StageId): StageQuantities`. `StageId` is imported from `./guidance`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/content/quantities.test.ts
import { test, expect } from 'bun:test';
import { QUANTITIES, getQuantitiesForStage } from './quantities';
import { STAGES } from './guidance';
import { ALL_SOURCE_IDS } from './sources'; // if not exported, compare against SOURCES keys

test('every stage has quantities', () => {
  for (const s of STAGES) {
    expect(QUANTITIES[s.id]).toBeDefined();
    expect(QUANTITIES[s.id].stageId).toBe(s.id);
  }
});

test('9-12 egg fraction is a quarter (thirds begin after 1 an)', () => {
  expect(QUANTITIES['9-12'].eggFraction).toBe('¼');
});

test('sources reference real SourceIds', () => {
  for (const q of Object.values(QUANTITIES)) {
    expect(q.sources.length).toBeGreaterThan(0);
  }
});

test('getQuantitiesForStage returns the matching row', () => {
  expect(getQuantitiesForStage('6-9').stageId).toBe('6-9');
});
```

- [ ] **Step 2: Run it — verify it fails**

Run: `bun test src/lib/content/quantities.test.ts`
Expected: FAIL (`Cannot find module './quantities'`).

- [ ] **Step 3: Verify the `9-12` protein figure**

Read `src/lib/content/guidance.ts` (`STAGES` `6-9` focus "10–20 g", `12-36` focus "~30 g à 1 an", `CATEGORY_GUIDANCE.viandes.cadence` "jusqu'à 30 g à 1 an"). Use `'20–30 g/j'` for `9-12` unless the cited copy is narrower.

- [ ] **Step 4: Write the module**

```ts
// src/lib/content/quantities.ts
// Structured, source-cited per-stage amounts. Figures lifted from guidance.ts —
// no new medical claims. One source of truth for the totals card and the
// per-item repères shown on the menu.
import type { StageId } from './guidance';
import type { SourceId } from './sources';

export type StageQuantities = {
  stageId: StageId;
  milkPerDay: string;
  meals: number;
  proteinPerDay: string;
  eggFraction: string | null;
  fishPerWeek: string | null;
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

export const QUANTITIES: Record<StageId, StageQuantities> = {
  '4-6': {
    stageId: '4-6',
    milkPerDay: '~600–800 mL/j',
    meals: 2,
    proteinPerDay: 'premières protéines vers 6 mois',
    eggFraction: null,
    fishPerWeek: null,
    portions: {
      legume: '~1–3 c. à café',
      fruit: '~1–3 c. à café',
      feculent: 'quelques c. à café',
      laitier: '—',
      matiereGrasse: '1 c. à café'
    },
    notes: ['Le lait reste le repas principal.', 'Une nouvelle saveur à la fois.'],
    sources: ['spf-pnns-guide', 'hcsp-2020', '1000-jours']
  },
  '6-9': {
    stageId: '6-9',
    milkPerDay: '~500 mL/j',
    meals: 4,
    proteinPerDay: '10–20 g/j (1×)',
    eggFraction: '¼',
    fishPerWeek: '2×/sem. dont un gras',
    portions: {
      legume: '~130 g',
      fruit: '~1 au goûter',
      feculent: '2–3 c. à soupe',
      laitier: '1 laitage',
      matiereGrasse: '1 c. à café/repas'
    },
    notes: ['Viande / poisson / œuf une fois par jour.'],
    sources: ['spf-pnns-guide', 'hcsp-2020', 'espghan-2017']
  },
  '9-12': {
    stageId: '9-12',
    milkPerDay: '~500 mL/j',
    meals: 4,
    proteinPerDay: '20–30 g/j (1×)',
    eggFraction: '¼',
    fishPerWeek: '2×/sem. dont un gras',
    portions: {
      legume: '~150 g',
      fruit: '~1 au goûter',
      feculent: '3–4 c. à soupe',
      laitier: '1 laitage',
      matiereGrasse: '1 c. à café/repas'
    },
    notes: ['Le tiers d’œuf commence après 1 an.'],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  '12-36': {
    stageId: '12-36',
    milkPerDay: '~500 mL/j (lait de croissance)',
    meals: 4,
    proteinPerDay: '30 g/j → 50 g vers 3 ans',
    eggFraction: '⅓–½',
    fishPerWeek: '2×/sem. dont un gras',
    portions: {
      legume: 'à chaque repas',
      fruit: 'à chaque repas',
      feculent: 'à chaque repas',
      laitier: '2–3/j',
      matiereGrasse: '1 c. à café/repas'
    },
    notes: ['Sel et sucre ajoutés restent à limiter.'],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  }
};

export function getQuantitiesForStage(stageId: StageId): StageQuantities {
  return QUANTITIES[stageId];
}
```

- [ ] **Step 5: Run tests — verify pass**

Run: `bun test src/lib/content/quantities.test.ts`
Expected: PASS. If the `sources` type errors, run `bun --bun svelte-check --tsconfig ./tsconfig.json` and align `SourceId`s with `src/lib/content/sources.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/content/quantities.ts src/lib/content/quantities.test.ts
git commit -m "feat(quantites): per-stage quantity content module"
```

---

### Task 2: `QuantitiesCard` component + i18n

**Files:**

- Create: `src/lib/components/menu/QuantitiesCard.svelte`
- Create: `src/lib/components/menu/QuantitiesCard.test.ts`
- Modify: `messages/fr.json`, `messages/en.json` (via the `i18n-add-key` skill)

**Interfaces:**

- Consumes: `StageQuantities` (Task 1).
- Produces: `<QuantitiesCard quantities={StageQuantities} ageMonths={number} />`.

- [ ] **Step 1: Add i18n keys** — invoke the `i18n-add-key` skill for each key (FR then EN):

| Key                 | FR                                      | EN                              |
| ------------------- | --------------------------------------- | ------------------------------- |
| `quantitiesHeading` | Combien lui donner ?                    | How much to give?               |
| `quantitiesMilk`    | Lait                                    | Milk                            |
| `quantitiesMeals`   | Repas                                   | Meals                           |
| `quantitiesProtein` | Viande · poisson · œuf                  | Meat · fish · egg               |
| `quantitiesEgg`     | Œuf                                     | Egg                             |
| `quantitiesSatiety` | Ce sont des repères : ne jamais forcer. | These are guides — never force. |

- [ ] **Step 2: Write the smoke test**

```ts
// src/lib/components/menu/QuantitiesCard.test.ts
import { test, expect } from 'bun:test';
import { render } from 'vitest-browser-svelte'; // use the repo's existing Svelte test util — check a sibling *.svelte.test/*.test that renders a component and copy its import
import QuantitiesCard from './QuantitiesCard.svelte';
import { QUANTITIES } from '$lib/content/quantities';

test('renders the daily totals for the stage', async () => {
  const screen = render(QuantitiesCard, { quantities: QUANTITIES['6-9'], ageMonths: 8 });
  await expect.element(screen.getByText('~500 mL/j')).toBeInTheDocument();
  await expect.element(screen.getByText('4')).toBeInTheDocument();
});
```

> Before writing this, open an existing component test (e.g. `src/lib/components/**/*.test.ts` that renders a `.svelte`) and mirror its exact render/import style — the repo has an established helper; do not introduce a new one.

- [ ] **Step 3: Run it — verify it fails**

Run: `bun test src/lib/components/menu/QuantitiesCard.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Write the component** (reuse the `Card` primitive; sage/tabular-nums per `PRODUCT.md`)

```svelte
<!-- src/lib/components/menu/QuantitiesCard.svelte -->
<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import type { StageQuantities } from '$lib/content/quantities';
  import * as m from '$lib/paraglide/messages';

  let { quantities, ageMonths }: { quantities: StageQuantities; ageMonths: number } = $props();
</script>

<Card class="p-4">
  <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">
    {m.quantitiesHeading()}
  </h2>
  <dl class="grid grid-cols-2 gap-3 tabular-nums sm:grid-cols-4">
    <div>
      <dt class="text-xs text-ink-soft">{m.quantitiesMilk()}</dt>
      <dd class="font-bold">{quantities.milkPerDay}</dd>
    </div>
    <div>
      <dt class="text-xs text-ink-soft">{m.quantitiesMeals()}</dt>
      <dd class="font-bold">{quantities.meals}</dd>
    </div>
    <div>
      <dt class="text-xs text-ink-soft">{m.quantitiesProtein()}</dt>
      <dd class="font-bold">{quantities.proteinPerDay}</dd>
    </div>
    {#if quantities.eggFraction}
      <div>
        <dt class="text-xs text-ink-soft">{m.quantitiesEgg()}</dt>
        <dd class="font-bold">{quantities.eggFraction}</dd>
      </div>
    {/if}
  </dl>
  <p class="mt-3 text-xs text-ink-soft">{m.quantitiesSatiety()}</p>
</Card>
```

- [ ] **Step 5: Run tests — verify pass**

Run: `bun test src/lib/components/menu/QuantitiesCard.test.ts && bun run lint:i18n`
Expected: PASS; i18n parity check green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/menu/QuantitiesCard.svelte src/lib/components/menu/QuantitiesCard.test.ts messages/
git commit -m "feat(quantites): QuantitiesCard daily-totals component"
```

---

### Task 3: PRODUCT.md amendment (gates Phase 2)

**Files:**

- Modify: `PRODUCT.md` (the "Anti-user" section, ~line 36)

- [ ] **Step 1: Add the carve-out** under the "Anti-user" bullet that rejects "AI-generated meal plans":

```markdown
> **Carve-out (2026-07):** A _deterministic, source-cited daily meal-idea surface_ —
> composed only from the curated catalog, framed as _repères_ not prescriptions, LLM-free and
> telemetry-free — is an accepted extension of `/suggestions`, distinct from the rejected
> "AI-generated meal plans" (which meant non-deterministic, cloud, authored-content plans).
```

- [ ] **Step 2: Commit**

```bash
git add PRODUCT.md
git commit -m "docs(product): carve out the deterministic meal-idea surface"
```

> **Phase gate:** if the owner rejects this framing, stop before Phase 2 and escalate. Phase 1 (Tasks 1–2) ships regardless.

---

## Phase 2 — Menu engine + safety

### Task 4: deterministic rotation helper (FNV-1a + compacted pick)

**Files:**

- Create: `src/lib/server/menu/rotation.ts`
- Test: `src/lib/server/menu/rotation.test.ts`

**Interfaces:**

- Produces: `function fnv1a(s: string): number` (unsigned 32-bit); `function rotatePick<T>(items: T[], key: string, step: number): T | null` — returns `items[((step + fnv1a(key)) % n + n) % n]` for `n = items.length`, or `null` when empty. `items` MUST be pre-sorted canonically by the caller.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/menu/rotation.test.ts
import { test, expect } from 'bun:test';
import { fnv1a, rotatePick } from './rotation';

test('fnv1a is unsigned and stable', () => {
  const h = fnv1a('child:1:midi:legume');
  expect(h).toBeGreaterThanOrEqual(0);
  expect(h).toBe(fnv1a('child:1:midi:legume'));
});

test('rotatePick never returns undefined for a non-empty list', () => {
  const items = ['a', 'b', 'c'];
  for (let d = 0; d < 20; d++) expect(items).toContain(rotatePick(items, 'k', d));
});

test('rotatePick has no consecutive-day repeat when length >= 2', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
  for (let d = 0; d < 30; d++) {
    expect(rotatePick(items, 'k', d)).not.toBe(rotatePick(items, 'k', d + 1));
  }
});

test('rotatePick returns null on empty', () => {
  expect(rotatePick([], 'k', 3)).toBeNull();
});
```

- [ ] **Step 2: Run it — verify it fails.** Run: `bun test src/lib/server/menu/rotation.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/server/menu/rotation.ts
// Deterministic slot rotation. Reuses the day-index idiom from
// guidance.ts:pickRotatingTip, but indexes the CALLER's compacted list so
// consecutive days pick adjacent entries (no consecutive-day repeat when n>=2).
export function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0; // unsigned 32-bit
}

export function rotatePick<T>(items: T[], key: string, step: number): T | null {
  const n = items.length;
  if (n === 0) return null;
  const idx = (((step + fnv1a(key)) % n) + n) % n;
  return items[idx];
}
```

- [ ] **Step 4: Run tests — verify pass.** Run: `bun test src/lib/server/menu/rotation.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/menu/rotation.ts src/lib/server/menu/rotation.test.ts
git commit -m "feat(menu): deterministic FNV-1a rotation helper"
```

---

### Task 5: canonical Europe/Paris day + Monday-origin weekday

**Files:**

- Create: `src/lib/server/menu/day.ts`
- Test: `src/lib/server/menu/day.test.ts`

**Interfaces:**

- Produces: `function parisDay(nowMs: number): { dayIndex: number; weekday: number }` — `dayIndex` = civil-date ordinal (days since 1970-01-01) in `Europe/Paris`; `weekday` = `(dayIndex + 3) % 7` (0 = Monday; epoch day 0 is a Thursday, whose Monday-origin index is 3). MUST NOT re-apply a tz offset to the civil date.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/menu/day.test.ts
import { test, expect } from 'bun:test';
import { parisDay } from './day';

// 2026-07-04T00:30:00+02:00 (CEST) == 2026-07-03T22:30:00Z
const localMidnightPlus30 = Date.UTC(2026, 6, 3, 22, 30, 0);
// 2026-07-03T23:30:00+02:00 == 2026-07-03T21:30:00Z (still the 3rd locally)
const beforeLocalMidnight = Date.UTC(2026, 6, 3, 21, 30, 0);

test('rolls over at Paris local midnight, not UTC midnight', () => {
  expect(parisDay(localMidnightPlus30).dayIndex).toBe(
    parisDay(Date.UTC(2026, 6, 4, 10, 0, 0)).dayIndex
  );
  expect(parisDay(beforeLocalMidnight).dayIndex).toBe(parisDay(localMidnightPlus30).dayIndex - 1);
});

test('weekday is Monday-origin', () => {
  // 2026-07-06 is a Monday
  expect(parisDay(Date.UTC(2026, 6, 6, 10, 0, 0)).weekday).toBe(0);
});
```

- [ ] **Step 2: Run it — verify it fails.** → FAIL.

- [ ] **Step 3: Implement** (civil date via `Intl`, parsed at UTC-midnight — no offset re-applied)

```ts
// src/lib/server/menu/day.ts
const PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function parisDay(nowMs: number): { dayIndex: number; weekday: number } {
  // en-CA formats as YYYY-MM-DD; treat it as a plain civil date at UTC midnight.
  const [y, mo, d] = PARIS.format(new Date(nowMs)).split('-').map(Number);
  const dayIndex = Math.floor(Date.UTC(y, mo - 1, d) / 86_400_000);
  const weekday = (((dayIndex + 3) % 7) + 7) % 7; // epoch day 0 = Thursday (Monday-origin index 3)
  return { dayIndex, weekday };
}
```

- [ ] **Step 4: Run tests — verify pass.** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/menu/day.ts src/lib/server/menu/day.test.ts
git commit -m "feat(menu): canonical Europe/Paris day + Monday weekday"
```

---

### Task 6: engine content — templates, role pools, protein week, choking map, forbidden-food data

**Files:**

- Create: `src/lib/server/menu/tables.ts`
- Modify: `src/lib/content/guidance.ts` (add `nameMatchers`+`untilMonths` to `FORBIDDEN_FOODS.lait-cru` is NOT done — see note; add nothing to `sel`)
- Test: `src/lib/server/menu/tables.test.ts`

**Interfaces:**

- Produces: `type RoleId = 'legume'|'proteine'|'feculent'|'matiereGrasse'|'dessert'|'laitier'|'fruit'`; `type MealId = 'matin'|'midi'|'gouter'|'soir'`; `MEAL_TEMPLATES: Record<StageId, {id: MealId; roles: RoleId[]}[]>`; `ROLE_POOLS: Record<RoleId, CategoryId[]>`; `PROTEIN_WEEK: CategoryId[]` (length 7); `OILY_FISH: string[]`; `NOVELTY_CATEGORIES: CategoryId[]` (role-bearing only); `CHOKING_BY_FOOD: Record<string, string>`; `CHARCUTERIE_MATCHERS: string[]`; `SOFT_CHEESE: string[]`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/menu/tables.test.ts
import { test, expect } from 'bun:test';
import { PROTEIN_WEEK, CHOKING_BY_FOOD, ROLE_POOLS, NOVELTY_CATEGORIES } from './tables';
import { FOODS_SEED } from '$lib/server/db/seed';

const names = new Set(FOODS_SEED.map((f) => f.name));

test('PROTEIN_WEEK has 7 days with fish twice', () => {
  expect(PROTEIN_WEEK).toHaveLength(7);
  expect(PROTEIN_WEEK.filter((c) => c === 'poissons')).toHaveLength(2);
});

test('CHOKING_BY_FOOD keys all exist in the seed (no orphans)', () => {
  for (const k of Object.keys(CHOKING_BY_FOOD)) expect(names.has(k)).toBe(true);
});

test('known choke-relevant foods are covered (incl. whole round berries)', () => {
  for (const f of [
    'Tomate',
    'Raisin (coupé en 4)',
    'Carotte',
    'Pomme',
    'Concombre',
    'Poivron',
    'Salade verte',
    'Myrtille',
    'Cassis'
  ]) {
    expect(CHOKING_BY_FOOD[f]).toBeDefined();
  }
});

test('matière grasse pool excludes the nut oil', () => {
  expect(ROLE_POOLS.matiereGrasse).toContain('matieres_grasses');
  // Huile de noix exclusion is enforced in the engine by name; assert the category is fat-only
});

test('novelty categories are role-bearing only (no allergenes/aromates)', () => {
  expect(NOVELTY_CATEGORIES).not.toContain('allergenes');
  expect(NOVELTY_CATEGORIES).not.toContain('aromates');
});
```

- [ ] **Step 2: Run it — verify it fails.** → FAIL.

- [ ] **Step 3: Implement the tables**

```ts
// src/lib/server/menu/tables.ts
import type { CategoryId } from '$lib/utils/categories';
import type { StageId } from '$lib/content/guidance';

export type RoleId =
  | 'legume'
  | 'fruit'
  | 'proteine'
  | 'feculent'
  | 'matiereGrasse'
  | 'laitier'
  | 'dessert';
export type MealId = 'matin' | 'midi' | 'gouter' | 'soir';

// Meal templates by stage. `4-6` and `<4` are handled by the engine's age branch
// (single food / no solids); this table drives 6-9, 9-12, 12-36.
const FULL_DAY: { id: MealId; roles: RoleId[] }[] = [
  { id: 'matin', roles: ['laitier', 'fruit'] },
  { id: 'midi', roles: ['legume', 'proteine', 'feculent', 'matiereGrasse', 'dessert'] },
  { id: 'gouter', roles: ['fruit', 'laitier'] },
  { id: 'soir', roles: ['legume', 'feculent', 'matiereGrasse', 'dessert'] }
];

export const MEAL_TEMPLATES: Record<StageId, { id: MealId; roles: RoleId[] }[]> = {
  '4-6': [{ id: 'midi', roles: ['legume'] }], // engine degrades to a single food
  '6-9': FULL_DAY,
  '9-12': FULL_DAY,
  '12-36': FULL_DAY
};

export const ROLE_POOLS: Record<RoleId, CategoryId[]> = {
  legume: ['legumes'],
  fruit: ['fruits'],
  proteine: ['viandes', 'poissons', 'oeufs', 'legumineuses'],
  feculent: ['feculents'],
  matiereGrasse: ['matieres_grasses'],
  laitier: ['produits_laitiers'],
  dessert: ['fruits', 'produits_laitiers']
};

// Monday-origin (index 0 = Monday). Fish twice incl. one oily (index 1).
export const PROTEIN_WEEK: CategoryId[] = [
  'viandes',
  'poissons',
  'legumineuses',
  'oeufs',
  'poissons',
  'viandes',
  'legumineuses'
];
export const OILY_FISH = ['Saumon', 'Sardine', 'Maquereau', 'Truite'];

// Role-bearing food categories the proactive non-allergen novelty may draw from.
export const NOVELTY_CATEGORIES: CategoryId[] = [
  'legumes',
  'fruits',
  'feculents',
  'legumineuses',
  'viandes',
  'poissons',
  'oeufs',
  'produits_laitiers'
];

// Nut oil is a fruits_a_coque allergen; never rotate it into the silent fat slot.
export const FAT_EXCLUDE = ['Huile de noix'];

// Charcuterie (salt/processed) stays out of the composable protéine pool at ALL ages.
// Plain "Porc" is a fine cooked protein, so it is NOT here — it's excluded only by the
// `porc` dietary preference (PORC_MATCHERS).
export const CHARCUTERIE_MATCHERS = ['Jambon'];
export const PORC_MATCHERS = ['Porc', 'Jambon']; // the `porc` dietary exclusion

// Soft/fresh cheeses that must carry a pasteurised caveat on the menu.
export const SOFT_CHEESE = ['Camembert', 'Chèvre frais', 'Brebis (fromage)'];

// Curated seed-name → choking rule. Keys MUST match FOODS_SEED names exactly
// (the CHOKING_HAZARDS keys in guidance.ts do NOT, so we can't string-match).
export const CHOKING_BY_FOOD: Record<string, string> = {
  Tomate: 'Peler et couper en petits morceaux.',
  'Raisin (coupé en 4)': 'Couper en 4 dans la longueur.',
  Carotte: 'Bien cuire jusqu’à fondant ; pas de bâtonnet cru avant 4 ans.',
  Pomme: 'Cuire ou râper finement ; pas de morceau dur cru.',
  Concombre: 'Épépiner et couper en fins bâtonnets tendres.',
  Poivron: 'Peler, cuire, couper fin.',
  'Salade verte': 'Couper très finement.',
  Myrtille: 'Écraser ou couper en deux (baie ronde).',
  Cassis: 'Écraser ou couper en deux (baie ronde).'
};
```

> **Note (Safety 1):** do **not** add `untilMonths` to `FORBIDDEN_FOODS.sel` (it would re-admit charcuterie at ≥12 mo). Charcuterie exclusion is handled by `CHARCUTERIE_MATCHERS` in the engine, age-independently. No `guidance.ts` change is required for this task; leave `FORBIDDEN_FOODS` as-is and rely on `suggestedAgeMonths` + these matchers. The `forbiddenAtAge` step-0 filter is **defensive-only** — today only `FORBIDDEN_FOODS.miel` carries both `untilMonths` + `nameMatchers`, and honey isn't a seed food — so the real guards for the current catalog are `suggestedAgeMonths`, `CHARCUTERIE_MATCHERS`, `SOFT_CHEESE`, and `FAT_EXCLUDE`. Task 7's raw-milk-cheese test asserts every such seed food is blocked-or-cautioned, and a `SOFT_CHEESE` rename-drift guard asserts every `SOFT_CHEESE` name still resolves to a seed food, so this coupling can't silently drift. Residual: a brand-new soft raw-milk cheese added to the seed must be hand-added to `SOFT_CHEESE` — there is no name-only signal to derive that safely.

- [ ] **Step 4: Run tests — verify pass.** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/menu/tables.ts src/lib/server/menu/tables.test.ts
git commit -m "feat(menu): meal templates, role pools, protein week, choking map"
```

---

### Task 7: engine — filtering, safe/introduced-base, age branch

**Files:**

- Create: `src/lib/server/menu/engine.ts`
- Test: `src/lib/server/menu/engine.test.ts` (grows across Tasks 7–9)

**Interfaces:**

- Consumes: Tasks 4–6.
- Produces: `type MenuInput`, `type MenuItem`, `type Meal`, `type Menu`, `function buildMenu(input: MenuInput): Menu`. Exact shapes are in the spec (§The engine). `Food` is `import type { Food } from '$lib/server/db/schema'`.

- [ ] **Step 1: Write failing tests for filtering + age branch**

```ts
// src/lib/server/menu/engine.test.ts
import { test, expect } from 'bun:test';
import { buildMenu, cautionFor, type MenuInput } from './engine';
import { SOFT_CHEESE } from './tables';
import { FOODS_SEED } from '$lib/server/db/seed';

// Build a catalog with stable ids from the seed (id = index+1, isCustom=false).
const CATALOG = FOODS_SEED.map((f, i) => ({
  id: i + 1,
  name: f.name,
  category: f.category,
  isMajorAllergen: f.allergen != null,
  allergenType: f.allergen ?? null,
  suggestedAgeMonths: f.age,
  notes: null,
  isCustom: false,
  customForChildId: null
}));

function baseInput(over: Partial<MenuInput> = {}): MenuInput {
  return {
    childId: 1,
    ageMonths: 8,
    dayIndex: 20638,
    weekday: 0,
    catalog: CATALOG,
    introducedFoodIds: new Set(CATALOG.map((f) => f.id)), // "everything introduced" baseline
    avoidFoodIds: new Set(),
    reactionTierFoodIds: new Set(),
    introducedAllergens: new Set(),
    reactedAllergens: new Set(),
    dietaryExclusions: [],
    ...over
  };
}

test('a 3-month-old gets zero solids', () => {
  const menu = buildMenu(baseInput({ ageMonths: 3 }));
  expect(menu.meals.flatMap((mo) => mo.items)).toHaveLength(0);
});

test('a 4-5 month-old gets a single food', () => {
  const menu = buildMenu(baseInput({ ageMonths: 5 }));
  expect(menu.meals.flatMap((mo) => mo.items)).toHaveLength(1);
});

test('never suggests a food above the child age', () => {
  const menu = buildMenu(baseInput({ ageMonths: 6 }));
  for (const it of menu.meals.flatMap((mo) => mo.items)) {
    expect(it.food.suggestedAgeMonths).toBeLessThanOrEqual(6);
  }
});

test('Jambon is never a protéine at any age', () => {
  const menu = buildMenu(baseInput({ ageMonths: 12 }));
  const proteins = menu.meals.flatMap((mo) => mo.items).filter((i) => i.role === 'proteine');
  expect(proteins.some((p) => p.food.name.includes('Jambon'))).toBe(false);
});

test('every raw-milk cheese seed food carries a pasteurised caution', () => {
  for (const name of ['Camembert', 'Chèvre frais', 'Brebis (fromage)']) {
    const food = CATALOG.find((f) => f.name === name)!;
    expect(cautionFor(food)).toContain('pasteurisé');
  }
});

test('every SOFT_CHEESE name still matches a seed food (rename-drift guard)', () => {
  // If a seed cheese is renamed without updating SOFT_CHEESE, the caution silently vanishes.
  const seedNames = new Set(FOODS_SEED.map((f) => f.name));
  for (const name of SOFT_CHEESE) expect(seedNames.has(name)).toBe(true);
});
```

- [ ] **Step 2: Run — verify it fails.** → FAIL.

- [ ] **Step 3: Implement filtering + age branch + skeleton `buildMenu`**

```ts
// src/lib/server/menu/engine.ts
import type { Food } from '$lib/server/db/schema';
import type { CategoryId } from '$lib/utils/categories';
import { getStageForAgeMonths, type StageId } from '$lib/content/guidance';
import { getQuantitiesForStage, type StageQuantities } from '$lib/content/quantities';
import { FORBIDDEN_FOODS } from '$lib/content/guidance';
import {
  ROLE_POOLS,
  FAT_EXCLUDE,
  CHARCUTERIE_MATCHERS,
  PORC_MATCHERS,
  SOFT_CHEESE,
  CHOKING_BY_FOOD,
  type RoleId,
  type MealId
} from './tables';

export type MenuInput = {
  childId: number;
  ageMonths: number;
  dayIndex: number;
  weekday: number;
  catalog: Food[];
  introducedFoodIds: Set<number>;
  avoidFoodIds: Set<number>;
  reactionTierFoodIds: Set<number>;
  introducedAllergens: Set<string>;
  reactedAllergens: Set<string>;
  dietaryExclusions: string[]; // DietExclusion[] once Phase 3 lands
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

const CHARCUTERIE = (f: Food) => CHARCUTERIE_MATCHERS.some((m) => f.name.includes(m));

function forbiddenAtAge(f: Food, ageMonths: number): boolean {
  for (const ff of FORBIDDEN_FOODS) {
    if (ff.untilMonths == null || !ff.nameMatchers) continue;
    if (ageMonths < ff.untilMonths && ff.nameMatchers.some((s) => f.name.toLowerCase().includes(s)))
      return true;
  }
  return false;
}

function excludedByDiet(f: Food, exclusions: string[]): boolean {
  if (exclusions.includes('porc') && PORC_MATCHERS.some((m) => f.name.includes(m))) return true;
  if (exclusions.includes('vegetarien') && (f.category === 'viandes' || f.category === 'poissons'))
    return true;
  if (exclusions.includes('sans_poisson') && f.category === 'poissons') return true;
  return false;
}

/** Age-eligible ∩ ¬forbidden ∩ ¬diet ∩ ¬reaction-blocked, for a role, sorted by id. */
function safeForRole(role: RoleId, input: MenuInput): Food[] {
  const cats = new Set<CategoryId>(ROLE_POOLS[role]);
  const ageMax = Math.max(input.ageMonths, 4);
  return input.catalog
    .filter((f) => !f.isCustom)
    .filter((f) => cats.has(f.category as CategoryId))
    .filter((f) => f.suggestedAgeMonths <= ageMax)
    .filter((f) => !forbiddenAtAge(f, input.ageMonths))
    .filter((f) => !excludedByDiet(f, input.dietaryExclusions))
    .filter((f) => (role === 'matiereGrasse' ? !FAT_EXCLUDE.includes(f.name) : true))
    .filter((f) => (role === 'proteine' ? !CHARCUTERIE(f) : true))
    .filter((f) => {
      // reaction avoidance: per-food for inconfort, per-allergen for reaction tier
      if (input.avoidFoodIds.has(f.id) && !input.reactionTierFoodIds.has(f.id)) return false;
      if (f.allergenType && input.reactedAllergens.has(f.allergenType)) return false;
      if (input.reactionTierFoodIds.has(f.id)) return false;
      return true;
    })
    .sort((a, b) => a.id - b.id);
}

const textureFor = (f: Food): string | null => CHOKING_BY_FOOD[f.name] ?? null;

function cautionFor(f: Food): string | null {
  const choke = textureFor(f);
  if (choke) return choke;
  if (f.category === 'poissons') return 'Bien cuit, sans arêtes.';
  if (f.category === 'viandes') return 'Haché ou petits morceaux fondants.';
  if (SOFT_CHEESE.includes(f.name)) return 'Au lait pasteurisé uniquement.';
  return null;
}

export function buildMenu(input: MenuInput): Menu {
  const stage = getStageForAgeMonths(input.ageMonths);
  const quantities = getQuantitiesForStage(stage.id);
  const base: Menu = {
    stageId: stage.id,
    quantities,
    textures: stage.textures,
    redFlags: [...stage.redFlags],
    meals: [],
    allergenFocus: null,
    noveltyFoodId: null
  };

  // Age branch FIRST (getStageForAgeMonths clamps <4 to '4-6').
  if (input.ageMonths < 4) return base; // zero solids, milk message only
  // 4-6: single food (filled by rotation in Task 8); return base here until Task 8.
  return base; // completed in Task 8/9
}

const mkItem = (
  role: RoleId,
  food: Food,
  stageTexture: string,
  amountHint: string | null,
  isNew: boolean
): MenuItem => ({
  role,
  food,
  amountHint,
  texture: stageTexture,
  caution: cautionFor(food),
  isNew,
  allergenType: food.allergenType
});

export { safeForRole, mkItem, cautionFor }; // internal, exported for unit tests
```

> **Import hygiene (matters for the per-task commits):** `engine.ts` imports only what each task actually uses, because `@typescript-eslint/no-unused-vars` is `error` (no autofix; `--no-verify` is banned by CLAUDE.md), so a commit carrying a not-yet-used import fails the husky/lint-staged pre-commit. Task 8 adds `MEAL_TEMPLATES`/`PROTEIN_WEEK`/`OILY_FISH` + `rotatePick`; Task 9 adds `NOVELTY_CATEGORIES` + `PRIORITY_INTRODUCTION_ALLERGENS`. Each of those steps begins by extending the import block.

- [ ] **Step 4: Run — the age-branch tests pass; the "single food"/protein tests may still fail** (rotation lands in Task 8). Confirm the `<4mo` = 0 items test passes now.

Run: `bun test src/lib/server/menu/engine.test.ts -t "3-month"`
Expected: PASS for the `<4` test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/menu/engine.ts src/lib/server/menu/engine.test.ts
git commit -m "feat(menu): engine filtering + age branch"
```

---

### Task 8: engine — rotation, meal assembly, protein occurrence counter

**Files:**

- Modify: `src/lib/server/menu/engine.ts`
- Test: `src/lib/server/menu/engine.test.ts`

**Interfaces:**

- Produces (internal): `function proteinOccurrence(cat, dayIndex, weekday): number` (occurrence-strided counter) and `function pickProtein(input): Food | null` (introduced-only, category-of-the-day via inlined `PROTEIN_WEEK[weekday]`); fills `Menu.meals` for stages `4-6`/`6-9`/`9-12`/`12-36`.

- [ ] **Step 1: Add failing tests**

```ts
test('determinism: same input → deep-equal, order-independent', () => {
  const a = buildMenu(baseInput());
  const shuffled = baseInput({ catalog: [...CATALOG].reverse() });
  expect(buildMenu(shuffled)).toEqual(a);
});

test('no consecutive-day repeat in the midi légume slot (introduced pool large)', () => {
  const prev = buildMenu(baseInput({ dayIndex: 100 }));
  const next = buildMenu(baseInput({ dayIndex: 101 }));
  const leg = (mn: ReturnType<typeof buildMenu>) =>
    mn.meals.find((x) => x.id === 'midi')!.items.find((i) => i.role === 'legume')!.food.id;
  expect(leg(prev)).not.toBe(leg(next));
});

test('fish appears >= 2x incl. one oily over a Mon-Sun week', () => {
  const fishNames: string[] = [];
  for (let w = 0; w < 7; w++) {
    const mn = buildMenu(baseInput({ dayIndex: 100 + w, weekday: w }));
    const p = mn.meals.find((x) => x.id === 'midi')!.items.find((i) => i.role === 'proteine');
    if (p && p.food.category === 'poissons') fishNames.push(p.food.name);
  }
  expect(fishNames.length).toBeGreaterThanOrEqual(2);
  expect(fishNames.some((n) => ['Saumon', 'Sardine', 'Maquereau', 'Truite'].includes(n))).toBe(
    true
  );
});
```

- [ ] **Step 2: Run — verify failing.** → FAIL.

- [ ] **Step 3: Implement rotation + assembly** (replace the `buildMenu` body after the `<4` guard)

```ts
// Extend the top-of-file imports first: add MEAL_TEMPLATES, PROTEIN_WEEK, OILY_FISH to the
// existing `./tables` import, then add a new line: import { rotatePick } from './rotation';

// helpers (add near mkItem)
function proteinOccurrence(cat: CategoryId, dayIndex: number, weekday: number): number {
  // Count same-category protein-weekdays in [0, dayIndex] in the single Monday frame, so a
  // category's successive appearances stride by exactly 1 (even for a hypothetical k=3 pool).
  const startMonday = dayIndex - weekday; // dayIndex of this week's Monday
  const fullWeeks = Math.max(0, Math.floor(startMonday / 7)); // dayIndex >= 0 in prod
  const perWeek = PROTEIN_WEEK.filter((c) => c === cat).length;
  let occ = fullWeeks * perWeek;
  for (let d = 0; d <= weekday; d++) if (PROTEIN_WEEK[d] === cat) occ++;
  return occ;
}

// INTRODUCED-ONLY. Empty weekday-category (or vegetarien/sans_poisson) → the whole
// introduced-safe protein pool. NEVER an un-introduced food — that would be a covert second
// novelty (the one-novelty hazard). null → "à découvrir" when no protein is introduced yet.
function pickProtein(input: MenuInput): Food | null {
  const cat = PROTEIN_WEEK[input.weekday];
  const introducedSafe = safeForRole('proteine', input).filter((f) =>
    input.introducedFoodIds.has(f.id)
  );
  const inCat = introducedSafe.filter((f) => f.category === cat);
  const pool = inCat.length ? inCat : introducedSafe;
  if (pool.length === 0) return null;
  const oily = input.weekday === 1 ? pool.filter((f) => OILY_FISH.includes(f.name)) : [];
  const list = oily.length ? oily : pool;
  const occ = proteinOccurrence(cat, input.dayIndex, input.weekday);
  return list[((occ % list.length) + list.length) % list.length];
}

// ---- inside buildMenu, replacing the body after the `<4` guard ----
const q = quantities.portions;
const amount = (role: RoleId): string | null =>
  role === 'proteine'
    ? quantities.proteinPerDay
    : role === 'legume'
      ? q.legume
      : role === 'fruit'
        ? q.fruit
        : role === 'feculent'
          ? q.feculent
          : role === 'laitier' || role === 'dessert'
            ? q.laitier
            : role === 'matiereGrasse'
              ? q.matiereGrasse
              : null;

// 4-6: exactly one first food (introduced-preferred; a genuine first food may be new and is
// then badged as the day's novelty). Returns BEFORE the full-day assembly + novelty pass.
if (stage.id === '4-6') {
  const pool = [...safeForRole('legume', input), ...safeForRole('fruit', input)].sort(
    (a, b) => a.id - b.id
  );
  const intro = pool.filter((f) => input.introducedFoodIds.has(f.id));
  const food = rotatePick(intro.length ? intro : pool, `${input.childId}:starter`, input.dayIndex);
  if (food) {
    const role: RoleId = food.category === 'fruits' ? 'fruit' : 'legume';
    const isNew = !input.introducedFoodIds.has(food.id);
    if (isNew) base.noveltyFoodId = food.id;
    base.meals = [
      {
        id: 'midi',
        label: food.name,
        items: [mkItem(role, food, stage.textures, amount(role), isNew)]
      }
    ];
  }
  return base;
}

// 6-9 / 9-12 / 12-36: each slot picks from its INTRODUCED-safe foods only.
for (const t of MEAL_TEMPLATES[stage.id]) {
  const items: MenuItem[] = [];
  for (const role of t.roles) {
    const food =
      role === 'proteine'
        ? pickProtein(input)
        : rotatePick(
            safeForRole(role, input).filter((f) => input.introducedFoodIds.has(f.id)),
            `${input.childId}:${t.id}:${role}`,
            input.dayIndex
          );
    if (food) items.push(mkItem(role, food, stage.textures, amount(role), false));
    // null → empty slot; MenuDay renders an "à découvrir" prompt for the missing role.
  }
  base.meals.push({ id: t.id, label: '', items });
}

return base; // Task 9 inserts the novelty/dedup pass just before this return.
```

> The `label` (middot-joined ingredient list) is computed in Task 9 after dedup/novelty settle. Empty slots (null food) are simply omitted here; MenuDay renders the "à découvrir" prompt by comparing the template's roles to the produced items.

- [ ] **Step 4: Run — determinism + no-repeat + fish tests pass.** → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/menu/engine.ts src/lib/server/menu/engine.test.ts
git commit -m "feat(menu): rotation, meal assembly, protein weekday schedule"
```

---

### Task 9: engine — one proactive novelty, allergen focus, dedup, labels

**Files:**

- Modify: `src/lib/server/menu/engine.ts`
- Test: `src/lib/server/menu/engine.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
import { PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';

test('at most one new food per day; every unbadged item is already introduced', () => {
  const intro = new Set(CATALOG.filter((f) => f.category !== 'legumes').map((f) => f.id));
  const menu = buildMenu(
    baseInput({
      introducedFoodIds: intro,
      introducedAllergens: new Set(PRIORITY_INTRODUCTION_ALLERGENS)
    })
  );
  const items = menu.meals.flatMap((mo) => mo.items);
  expect(items.filter((i) => !intro.has(i.food.id)).length).toBeLessThanOrEqual(1);
  for (const i of items) if (!intro.has(i.food.id)) expect(i.isNew).toBe(true); // no covert novelty
});

test('the non-allergen novelty is rendered even if its role had no introduced food', () => {
  // no légume introduced; all allergens introduced → the non-allergen novelty path runs
  const intro = new Set(CATALOG.filter((f) => f.category !== 'legumes').map((f) => f.id));
  const menu = buildMenu(
    baseInput({
      introducedFoodIds: intro,
      introducedAllergens: new Set(PRIORITY_INTRODUCTION_ALLERGENS)
    })
  );
  const badged = menu.meals.flatMap((mo) => mo.items).filter((i) => i.isNew);
  expect(badged.length).toBe(1);
  expect(badged[0].food.category).toBe('legumes'); // inserted into midi even with no introduced légume
  expect(menu.noveltyFoodId).toBe(badged[0].food.id);
});

test('orphan allergen (arachide) is card-only, never a meal slot', () => {
  const peanut = CATALOG.find((f) => f.allergenType === 'arachide')!;
  const intro = new Set(CATALOG.filter((f) => f.id !== peanut.id).map((f) => f.id));
  const introAll = new Set(PRIORITY_INTRODUCTION_ALLERGENS.filter((a) => a !== 'arachide'));
  const menu = buildMenu(baseInput({ introducedFoodIds: intro, introducedAllergens: introAll }));
  expect(menu.allergenFocus?.food.allergenType).toBe('arachide');
  expect(menu.allergenFocus?.mode).toBe('introduce');
  expect(menu.meals.flatMap((mo) => mo.items).some((i) => i.food.id === peanut.id)).toBe(false);
  expect(menu.noveltyFoodId).toBe(peanut.id);
});

test('charcuterie (Jambon) is never surfaced as a protein novelty', () => {
  const jambon = CATALOG.find((f) => f.name.includes('Jambon'))!;
  // everything introduced EXCEPT Jambon, all allergens introduced → the novelty path runs and
  // Jambon is the sole un-introduced viandes candidate; catalogSafe must still reject it.
  const intro = new Set(CATALOG.filter((f) => f.id !== jambon.id).map((f) => f.id));
  const menu = buildMenu(
    baseInput({
      introducedFoodIds: intro,
      introducedAllergens: new Set(PRIORITY_INTRODUCTION_ALLERGENS)
    })
  );
  expect(menu.noveltyFoodId).not.toBe(jambon.id);
  const proteins = menu.meals.flatMap((mo) => mo.items).filter((i) => i.role === 'proteine');
  expect(proteins.some((p) => p.food.name.includes('Jambon'))).toBe(false);
});

test('reaction to Saumon blocks all poisson', () => {
  const saumon = CATALOG.find((f) => f.name === 'Saumon')!;
  const menu = buildMenu(
    baseInput({
      reactionTierFoodIds: new Set([saumon.id]),
      avoidFoodIds: new Set([saumon.id]),
      reactedAllergens: new Set(['poisson'])
    })
  );
  expect(menu.meals.flatMap((mo) => mo.items).some((i) => i.food.category === 'poissons')).toBe(
    false
  );
});

test('allergenFocus.maintain re-offers only an introduced food', () => {
  const intro = new Set(CATALOG.map((f) => f.id));
  const menu = buildMenu(
    baseInput({
      introducedFoodIds: intro,
      introducedAllergens: new Set(PRIORITY_INTRODUCTION_ALLERGENS)
    })
  );
  if (menu.allergenFocus?.mode === 'maintain') {
    expect(intro.has(menu.allergenFocus.food.id)).toBe(true);
  }
});

test('sans_poisson never shows poisson as allergène du jour', () => {
  const menu = buildMenu(
    baseInput({ dietaryExclusions: ['sans_poisson'], introducedAllergens: new Set() })
  );
  expect(menu.allergenFocus?.food.allergenType).not.toBe('poisson');
});
```

- [ ] **Step 2: Run — verify failing.** → FAIL.

- [ ] **Step 3: Implement novelty/focus/dedup/label** (add before the `return base`)

```ts
// Extend the top-of-file imports first: add NOVELTY_CATEGORIES to the existing `./tables`
// import, then add: import { PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';

// ---- allergen focus + ONE proactive novelty (meals are already introduced-only) ----
const allowedAllergen = (a: string) =>
  !input.reactedAllergens.has(a) &&
  !(input.dietaryExclusions.includes('sans_poisson') && a === 'poisson') &&
  !(input.dietaryExclusions.includes('vegetarien') && a === 'poisson');

// The novelty path uses THIS predicate, not safeForRole — so it must repeat every
// role-independent safety gate safeForRole applies, or an un-safe food slips in as a badged
// "Nouveauté". Charcuterie (Jambon) is never a protéine AND never a novelty. FAT_EXCLUDE is
// defence-in-depth: matieres_grasses isn't in NOVELTY_CATEGORIES today, so it's currently
// unreachable — but adding it there must never turn butter into a novelty.
const catalogSafe = (f: Food) =>
  f.suggestedAgeMonths <= Math.max(input.ageMonths, 4) &&
  !f.isCustom &&
  !forbiddenAtAge(f, input.ageMonths) &&
  !excludedByDiet(f, input.dietaryExclusions) &&
  !CHARCUTERIE(f) &&
  !FAT_EXCLUDE.includes(f.name) &&
  !input.avoidFoodIds.has(f.id) &&
  !(f.allergenType && input.reactedAllergens.has(f.allergenType));

let noveltyFood: Food | null = null;

// 1. A priority allergen due? Rotate the "allergène du jour" by dayIndex. It IS the day's one
//    novelty and is surfaced ONLY in the allergenFocus card (allergenes has no meal role;
//    role-bearing allergens stay card-only too, so no meal slot ever shows a new food).
const dueList = PRIORITY_INTRODUCTION_ALLERGENS.filter(
  (a) => !input.introducedAllergens.has(a) && allowedAllergen(a)
).sort();
const dueAllergen = rotatePick(dueList, `${input.childId}:allergenFocus`, input.dayIndex);
if (dueAllergen) {
  const food = input.catalog
    .filter((f) => f.allergenType === dueAllergen && catalogSafe(f))
    .sort((a, b) => a.id - b.id)[0];
  if (food) {
    base.allergenFocus = { food, mode: 'introduce' };
    noveltyFood = food; // card-only; never inserted into a meal slot
  }
}

// 2. No allergen to introduce → maintain focus on an INTRODUCED allergen food, and feature
//    ONE not-yet-tried role-bearing food in a meal slot.
if (!noveltyFood) {
  const maintainList = PRIORITY_INTRODUCTION_ALLERGENS.filter(
    (a) => input.introducedAllergens.has(a) && allowedAllergen(a)
  ).sort();
  const maintainA = rotatePick(maintainList, `${input.childId}:maintain`, input.dayIndex);
  if (maintainA) {
    const food = input.catalog
      .filter(
        (f) => f.allergenType === maintainA && input.introducedFoodIds.has(f.id) && catalogSafe(f)
      )
      .sort((a, b) => a.id - b.id)[0];
    if (food) base.allergenFocus = { food, mode: 'maintain' };
  }
  const candidates = input.catalog
    .filter((f) => NOVELTY_CATEGORIES.includes(f.category as CategoryId))
    .filter((f) => !input.introducedFoodIds.has(f.id))
    .filter(catalogSafe)
    .sort((a, b) => a.id - b.id);
  const pick = rotatePick(candidates, `${input.childId}:novelty`, input.dayIndex);
  if (pick) {
    noveltyFood = pick;
    const role = roleForCategory(pick.category as CategoryId);
    if (role) placeNovelty(base, role, pick, stage.textures);
  }
}
base.noveltyFoodId = noveltyFood?.id ?? null;

// 3. intra-day dedup over the introduced base picks only (never the novelty).
const seen = new Set<number>();
for (const meal of base.meals) {
  for (const slot of meal.items) {
    if (slot.isNew) {
      seen.add(slot.food.id);
      continue;
    }
    if (seen.has(slot.food.id)) {
      const alt = rotatePick(
        safeForRole(slot.role, input).filter(
          (f) => input.introducedFoodIds.has(f.id) && !seen.has(f.id)
        ),
        `${input.childId}:${meal.id}:${slot.role}:dedup`,
        input.dayIndex
      );
      if (alt) {
        slot.food = alt;
        slot.caution = cautionFor(alt);
        slot.allergenType = alt.allergenType;
      }
    }
    seen.add(slot.food.id);
  }
  meal.label = meal.items.map((i) => i.food.name).join(' · ');
}
```

Add the small helper:

```ts
function roleForCategory(cat: CategoryId): RoleId | null {
  const map: Partial<Record<CategoryId, RoleId>> = {
    legumes: 'legume',
    fruits: 'fruit',
    feculents: 'feculent',
    legumineuses: 'proteine',
    viandes: 'proteine',
    poissons: 'proteine',
    oeufs: 'proteine',
    produits_laitiers: 'laitier',
    matieres_grasses: 'matiereGrasse'
  };
  return map[cat] ?? null;
}

// Feature the novelty in the EARLIEST meal whose TEMPLATE lists its role. Replace that role's
// introduced base pick if present; otherwise INSERT a new item (the slot was empty because no
// food of that role is introduced yet), so the one proactive novelty is never silently dropped.
function placeNovelty(menu: Menu, role: RoleId, food: Food, stageTexture: string): void {
  for (const t of MEAL_TEMPLATES[menu.stageId]) {
    if (!t.roles.includes(role)) continue;
    const meal = menu.meals.find((mo) => mo.id === t.id);
    if (!meal) continue;
    const item = mkItem(role, food, stageTexture, null, true);
    const existing = meal.items.find((i) => i.role === role);
    if (existing) Object.assign(existing, item);
    else meal.items.push(item);
    return;
  }
}
```

- [ ] **Step 4: Run the full engine suite — verify pass.** Run: `bun test src/lib/server/menu/engine.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/menu/engine.ts src/lib/server/menu/engine.test.ts
git commit -m "feat(menu): one-novelty pass, allergen focus, dedup, labels"
```

---

### Task 10: `/child/[id]/menu` loader

**Files:**

- Create: `src/routes/child/[id]/menu/+page.server.ts`
- Test: `src/routes/child/[id]/menu/page.server.test.ts` (mirror `suggestions/page.server.test.ts`)

- [ ] **Step 1: Write the failing loader test** (copy the harness setup from `src/routes/child/[id]/suggestions/page.server.test.ts` — same `makeRouteEvent`/`testDb` helpers).

```ts
// assert: returns { ageMonths, menu }; menu.meals is non-empty for an 8-mo child
// with introduced foods; a reacted food never appears; dietaryExclusions default [].
```

- [ ] **Step 2: Run — verify it fails.** → FAIL.

- [ ] **Step 3: Implement the loader** (reuse the exact query idioms from `suggestions/+page.server.ts`)

```ts
// src/routes/child/[id]/menu/+page.server.ts
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { and, eq, lte, sql } from 'drizzle-orm';
import { ageInMonths } from '$lib/utils/age';
import { REACTION_RANK } from '$lib/utils/reaction-values';
import { requireChildContext } from '$lib/server/guards';
import { buildMenu } from '$lib/server/menu/engine';
import { parisDay } from '$lib/server/menu/day';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, locals }) => {
  const { childId } = requireChildContext(locals, params);
  const { child } = await parent();
  const ageMonths = ageInMonths(child.birthDate);

  const entries = await db
    .select({
      foodId: foodEntries.foodId,
      reaction: foodEntries.reaction,
      allergenType: foods.allergenType
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(eq(foodEntries.childId, childId));

  const introducedFoodIds = new Set<number>();
  const introducedAllergens = new Set<string>();
  const avoidFoodIds = new Set<number>();
  const reactionTierFoodIds = new Set<number>();
  const reactedAllergens = new Set<string>();
  for (const e of entries) {
    introducedFoodIds.add(e.foodId);
    if (e.allergenType) introducedAllergens.add(e.allergenType);
    if (REACTION_RANK[e.reaction] >= REACTION_RANK['inconfort']) avoidFoodIds.add(e.foodId);
    if (REACTION_RANK[e.reaction] >= REACTION_RANK['reaction']) {
      reactionTierFoodIds.add(e.foodId);
      if (e.allergenType) reactedAllergens.add(e.allergenType);
    }
  }

  const catalog = await db
    .select()
    .from(foods)
    .where(and(eq(foods.isCustom, false), lte(foods.suggestedAgeMonths, Math.max(ageMonths, 4))))
    .orderBy(sql`${foods.id} ASC`);

  const { dayIndex, weekday } = parisDay(Date.now());
  // Phase 2: the column doesn't exist yet, so cast the row (not the value) to reach the
  // optional property without a "does not exist" typecheck error. Phase 3 drops the cast.
  const dietaryExclusions = (child as { dietaryExclusions?: string[] }).dietaryExclusions ?? [];

  const menu = buildMenu({
    childId,
    ageMonths,
    dayIndex,
    weekday,
    catalog,
    introducedFoodIds,
    avoidFoodIds,
    reactionTierFoodIds,
    introducedAllergens,
    reactedAllergens,
    dietaryExclusions
  });

  return { ageMonths, menu };
};
```

> Until Phase 3, `child.dietaryExclusions` does not exist — cast to `[]`. When Phase 3 lands, `child` already carries the column and this line becomes `child.dietaryExclusions`.

- [ ] **Step 4: Run — verify pass.** Run: `bun test src/routes/child/[id]/menu/` → PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/child/[id]/menu/+page.server.ts" "src/routes/child/[id]/menu/page.server.test.ts"
git commit -m "feat(menu): /menu loader"
```

---

### Task 11: `MenuDay` page + component + i18n

**Files:**

- Create: `src/routes/child/[id]/menu/+page.svelte`
- Create: `src/lib/components/menu/MenuDay.svelte`
- Modify: `messages/fr.json`, `messages/en.json` (i18n-add-key)

- [ ] **Step 1: Add i18n keys** (via `i18n-add-key`), values verbatim from the spec's i18n table: `menuTitle, menuSubtitle, menuMealMatin, menuMealMidi, menuMealGouter, menuMealSoir, menuRoleLegume, menuRoleProteine, menuRoleFeculent, menuRoleMatiereGrasse, menuRoleDessert, menuRoleLaitier, menuNovelty, menuNoveltyHint, menuAllergenOfDay, menuMilkPrimary, menuDiscoverSlot, menuSatiety`.

- [ ] **Step 2: Write `MenuDay.svelte`** (reuse `Card`, `Badge`, category helpers; link each item to the log flow; render "à découvrir" for roles the template wanted but the engine left empty).

```svelte
<!-- src/lib/components/menu/MenuDay.svelte -->
<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import type { Menu } from '$lib/server/menu/engine';
  import { getCategoryIcon } from '$lib/utils/categories';
  import * as m from '$lib/paraglide/messages';

  let { menu, childId }: { menu: Menu; childId: number } = $props();

  const mealLabel = (id: string) =>
    id === 'matin' ? m.menuMealMatin() : id === 'midi' ? m.menuMealMidi()
    : id === 'gouter' ? m.menuMealGouter() : m.menuMealSoir();
  const logHref = (foodId: number) => `/child/${childId}/menu/../log?foodId=${foodId}`.replace('/menu/..', '');
</script>

{#if menu.allergenFocus}
  <Card class="mb-4 bg-accent-lilac/20 p-4">
    <div class="text-xs font-semibold uppercase tracking-wider">{m.menuAllergenOfDay()}</div>
    <div class="font-medium">{menu.allergenFocus.food.name}</div>
  </Card>
{/if}

{#each menu.meals as meal (meal.id)}
  <Card class="mb-3 p-4">
    <h3 class="mb-2 font-semibold">{mealLabel(meal.id)}</h3>
    <p class="mb-2 text-xs text-ink-soft">{meal.label}</p>
    <ul class="space-y-1">
      {#each meal.items as it (it.role + it.food.id)}
        <li>
          <a href={logHref(it.food.id)} class="flex items-center justify-between gap-2 hover:underline">
            <span>{it.food.name}{#if it.amountHint} · <span class="text-ink-soft">{it.amountHint}</span>{/if}</span>
            {#if it.isNew}<Badge>{m.menuNovelty()}</Badge>{/if}
          </a>
          {#if it.caution}<div class="text-xs text-ink-soft">{it.caution}</div>{/if}
        </li>
      {/each}
    </ul>
  </Card>
{/each}
<p class="mt-2 text-xs text-ink-soft">{menu.textures} — {m.menuSatiety()}</p>
```

> **MUST** validate this component with the Svelte MCP `svelte-autofixer` (or the `svelte:svelte-file-editor` agent) before committing — Svelte 5 runes, no legacy syntax.

- [ ] **Step 3: Write `+page.svelte`** rendering `QuantitiesCard` + `MenuDay` + a `BackHeader`, using `data.menu` / `data.ageMonths`. If `ageMonths < 4`, show only `m.menuMilkPrimary()`.

- [ ] **Step 4: Smoke test + lint**

Run: `bun test src/lib/components/menu/ && bun run lint:i18n && bun --bun svelte-check --tsconfig ./tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/routes/child/[id]/menu/+page.svelte" src/lib/components/menu/MenuDay.svelte messages/
git commit -m "feat(menu): Menu du jour page + MenuDay component"
```

---

### Task 12: Aujourd'hui tile + Découvrir nav fold

**Files:**

- Modify: `src/lib/components/bento/AujourdhuiBento.svelte` (add a "Idées de repas" tile → `/menu`)
- Modify: `src/lib/components/BottomNavBento.svelte` (add `menu` to the Découvrir matcher)
- Modify: `src/lib/components/BottomNavBento.test.ts` (assert `/menu` → Découvrir active)

- [ ] **Step 1: Write the failing nav test** — assert that a pathname `/child/1/menu` marks the Découvrir tab active (mirror the existing `/guide` assertion).

- [ ] **Step 2: Run — verify it fails.** → FAIL.

- [ ] **Step 3: Add `menu` to the Découvrir matcher** (find the regex `guide|suggestions|sources` and add `|menu`).

- [ ] **Step 4: Add the Aujourd'hui tile** (lilac, links to `/child/{id}/menu`, label `m.menuNavTile()` — reuse `menuTitle` or add `menuNavTile`).

- [ ] **Step 5: Run — verify pass.** Run: `bun test src/lib/components/BottomNavBento.test.ts` → PASS.

- [ ] **Step 6: Refresh graph + commit**

```bash
graphify update .
git add src/lib/components/ graphify-out/
git commit -m "feat(menu): Aujourd'hui tile + Découvrir nav fold"
```

---

## Phase 3 — Dietary exclusions

### Task 13: `diet.ts` + `children.dietaryExclusions` column + migration

**Files:**

- Create: `src/lib/utils/diet.ts`
- Modify: `src/lib/server/db/schema.ts` (add the column)
- Create: `drizzle/00NN_*.sql` (generated)
- Test: `src/lib/server/db/schema.test.ts` (extend)

**Interfaces:**

- Produces: `const DIET_EXCLUSIONS = ['porc','vegetarien','sans_poisson'] as const`; `type DietExclusion`.

- [ ] **Step 1: Write `diet.ts`** (pure module, no Svelte/lucide import — like `reaction-values.ts`)

```ts
// src/lib/utils/diet.ts
export const DIET_EXCLUSIONS = ['porc', 'vegetarien', 'sans_poisson'] as const;
export type DietExclusion = (typeof DIET_EXCLUSIONS)[number];
export function parseDietExclusions(raw: unknown): DietExclusion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is DietExclusion => (DIET_EXCLUSIONS as readonly string[]).includes(x));
}
```

- [ ] **Step 2: Add the column to `schema.ts`** (mirror `passkeys.transports`)

```ts
// in the children table definition
dietaryExclusions: text('dietary_exclusions', { mode: 'json' })
  .$type<DietExclusion[]>()
  .notNull()
  .default(sql`'[]'`),
```

Add `import type { DietExclusion } from '../../utils/diet';` at the top (relative import — drizzle-kit loads schema.ts outside the alias resolver).

- [ ] **Step 3: Generate the migration**

Run: `bun run db:generate`
Expected: a new `drizzle/00NN_*.sql` with `ALTER TABLE children ADD 'dietary_exclusions' text DEFAULT '[]' NOT NULL;`. Inspect it; confirm no table rebuild.

- [ ] **Step 4: Extend the schema test** — assert a new child row reads `dietaryExclusions === []` by default, and a written `['porc']` round-trips.

- [ ] **Step 5: Run tests.** Run: `bun test src/lib/server/db/schema.test.ts src/lib/utils/diet.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/diet.ts src/lib/server/db/schema.ts drizzle/ src/lib/server/db/schema.test.ts
git commit -m "feat(diet): children.dietaryExclusions column + migration"
```

---

### Task 14: `setDiet` action + settings toggles

**Files:**

- Modify: `src/routes/child/[id]/settings/+page.server.ts` (add `?/setDiet`)
- Modify: `src/routes/child/[id]/settings/+page.svelte` (toggle group)
- Modify: `messages/fr.json`, `messages/en.json` (i18n-add-key: `settingsDietHeading/Porc/Vegetarien/SansPoisson`)
- Test: `src/routes/child/[id]/settings/page.server.test.ts`

- [ ] **Step 1: Write the failing action test** — posting `['porc','bogus']` persists `['porc']` (unknown dropped); a member (non-owner) can set it.

- [ ] **Step 2: Run — verify it fails.** → FAIL.

- [ ] **Step 3: Implement the action** (member-allowed via `requireChildContext`; validate with `parseDietExclusions`; set `updatedAt`)

```ts
// in settings +page.server.ts actions
setDiet: async ({ request, params, locals }) => {
  const { childId } = requireChildContext(locals, params);
  const form = await request.formData();
  const chosen = parseDietExclusions(form.getAll('diet'));
  await db
    .update(children)
    .set({ dietaryExclusions: chosen, updatedAt: new Date() })
    .where(eq(children.id, childId));
  return { success: true };
};
```

- [ ] **Step 4: Add the toggle group** to settings `+page.svelte` (three checkboxes named `diet`, values from `DIET_EXCLUSIONS`, labels via the new i18n keys), under a `m.settingsDietHeading()` section.

- [ ] **Step 5: Run — verify pass + i18n parity.** Run: `bun test src/routes/child/[id]/settings/ && bun run lint:i18n` → PASS.

- [ ] **Step 6: Commit**

```bash
git add "src/routes/child/[id]/settings/" messages/
git commit -m "feat(diet): setDiet action + settings toggles"
```

---

### Task 15: wire exclusions through the loader

**Files:**

- Modify: `src/routes/child/[id]/menu/+page.server.ts` (drop the `?? []` cast — use the real column)
- Test: `src/routes/child/[id]/menu/page.server.test.ts` (add exclusion cases)

- [ ] **Step 1: Add failing tests** — a `vegetarien` child's menu has no `viandes`/`poissons`; a `porc` child never gets Jambon; `sans_poisson` never shows poisson as allergène du jour.

- [ ] **Step 2: Run — verify it fails.** → FAIL.

- [ ] **Step 3: Use the real column** — drop the Phase 2 cast `const dietaryExclusions = (child as { dietaryExclusions?: string[] }).dietaryExclusions ?? [];` and read `child.dietaryExclusions` directly (now typed `DietExclusion[]`).

- [ ] **Step 4: Run — verify pass.** → PASS.

- [ ] **Step 5: Refresh graph + commit**

```bash
graphify update .
git add "src/routes/child/[id]/menu/" graphify-out/
git commit -m "feat(diet): wire dietary exclusions into the menu engine"
```

---

## Final verification (run before opening each phase's PR)

- [ ] `bun run check` (svelte-check + tsc) — no errors.
- [ ] `bun run lint` and `bun run lint:i18n` — clean, FR/EN parity.
- [ ] `bun test` — full suite green; new engine/day/rotation/tables/quantities/diet modules covered (check the `scripts/bun-test.ts` gate output; explicitly exercise the empty-slot/à-découvrir and novelty-cap branches).
- [ ] `bun run build` — production build succeeds.
- [ ] Manual smoke (`/run` skill or `DATABASE_PATH=./dev.db WEBAUTHN_RP_ID=localhost bun run dev`): open `/child/<id>/menu` at ages 3, 5, 8, 13 months; verify the milk-primary path (<4/4-6), one Nouveauté badge, texture cautions on Tomate/Cabillaud, and the "à découvrir" prompt on a fresh child.
- [ ] `graphify update .` committed.

---

## Self-review notes (author)

- **Spec coverage:** Quantités (T1–2), PRODUCT.md amendment (T3), rotation/day helpers (T4–5), tables incl. choking map + protein week (T6), engine filtering/age/rotation/protein/novelty/dedup/safety (T7–9), loader (T10), UI + nav (T11–12), dietary exclusions schema/action/wiring (T13–15). All spec §Safety guards map to T6/T7/T9/T11. Every §Testing bullet maps to a task test.
- **Type consistency:** `MenuInput`/`MenuItem`/`Menu` defined in T7 and consumed unchanged in T8–T11; `RoleId`/`MealId`/`CategoryId` from T6; `DietExclusion` from T13 (T7 uses `string[]` until T13, widened in T15 — intentional, called out).
- **Open items folded in:** `PROTEIN_WEEK`, `setDiet` member-auth, and the `9-12` protein figure are pinned in Global Constraints; the source-confirm is an explicit step in T1.
