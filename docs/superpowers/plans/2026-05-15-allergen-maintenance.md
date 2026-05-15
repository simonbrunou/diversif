# Allergen maintenance tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-day calm maintenance nudge for priority allergens, surfaced via a new `'fading'` state on the `/foods` allergens segment and a `maintain-allergen` rule in the dashboard reminders engine.

**Architecture:** Two pure additive slices on existing surfaces. The Carnet allergens tile gets a fourth state derived in `loadBentoAllergens`. The reminders engine gets rule 9 alongside the existing 8 rules, capped at 2 cards. No DB migration. No new wiring — `computeReminders` is already invoked from `src/routes/child/[id]/+page.server.ts:167`, and `EnrichedEntry.allergenType` already exists in `src/lib/server/guidance/queries.ts:17`.

**Tech Stack:** SvelteKit 2 + Drizzle (Postgres) + vitest + Paraglide i18n + Testing Library (svelte). Tests use `pg-mem` via `testDb` from `test/db`.

**Conventions:**

- Pre-commit runs husky + lint-staged (prettier + eslint). Do not bypass with `--no-verify`.
- French UI, no anglicisms. New strings live in `messages/fr.json` / `messages/en.json` and surface via Paraglide (`import * as m from '$lib/paraglide/messages'`).
- Hard-coded French is acceptable in server-side `reminders.ts` because that is the pattern of every existing rule (1–8) in the file.

---

## File map

### Modify (8 files)

- `messages/fr.json` — add `aujourdhuiAllergensFading` + `carnetAllergensFadingCaption`
- `messages/en.json` — same keys
- `src/lib/components/bento/CarnetAllergens.svelte` — widen `Item.state`, add fading rendering branch, update `stateLabel`, add days-since computation when fading
- `src/lib/components/bento/CarnetAllergens.test.ts` — add fading rendering test
- `src/lib/components/bento/CarnetBento.svelte` — widen the duplicated `AllergenItem.state`
- `src/routes/child/[id]/foods/+page.server.ts` — widen `AllergenItem.state`, inject `now`, derive `'fading'` in `loadBentoAllergens`
- `src/routes/child/[id]/foods/page.server.test.ts` — add fading derivation tests
- `src/lib/server/guidance/reminders.ts` — add rule 9 maintain-allergen
- `src/lib/server/guidance/reminders.test.ts` — add rule 9 test cases

### Create

(none)

---

## Task 1: Add i18n strings for the new state

**Files:**

- Modify: `messages/fr.json`
- Modify: `messages/en.json`

This is a tiny preparatory commit. The keys land first so subsequent tasks can call `m.aujourdhuiAllergensFading()` without breaking the Paraglide build.

- [ ] **Step 1: Add the FR keys**

Open `messages/fr.json`. Find the existing `aujourdhuiAllergensTodo` line (around line 218). Insert the two new keys immediately after it so the section stays grouped:

```json
  "aujourdhuiAllergensFading": "à reproposer",
  "carnetAllergensFadingCaption": "{days} j",
```

The trailing comma is required because there is at least one key after this block.

- [ ] **Step 2: Add the EN keys**

Open `messages/en.json`. Find `aujourdhuiAllergensTodo` (mirrored at the same offset around line 218). Insert:

```json
  "aujourdhuiAllergensFading": "to re-offer",
  "carnetAllergensFadingCaption": "{days} d",
```

- [ ] **Step 3: Regenerate Paraglide bindings**

Paraglide auto-regenerates on `npm run dev` / `vite build`. To force a regen now without starting the dev server:

```bash
npx @inlang/paraglide-js compile --project ./project.inlang --outdir src/lib/paraglide
```

Expected: no error output. `src/lib/paraglide/messages.js` (committed-or-generated) now exports `aujourdhuiAllergensFading` and `carnetAllergensFadingCaption`.

If the project uses a different paraglide command, check `package.json` scripts for one named like `paraglide`, `i18n`, or `messages`.

- [ ] **Step 4: Run a sanity vitest pass**

```bash
npx vitest run src/lib/components/bento/CarnetAllergens.test.ts
```

Expected: all 3 existing tests pass. The new keys do not break compile.

- [ ] **Step 5: Commit**

```bash
git add messages/fr.json messages/en.json src/lib/paraglide
git commit -m "i18n(allergens): add À reproposer / {days} j messages

For the upcoming maintenance state on the carnet allergens pill."
```

If `src/lib/paraglide/` is gitignored (auto-generated) the second path will be a no-op — that is expected; only commit the JSON files in that case.

---

## Task 2: Render the `'fading'` state on the Carnet allergens pill

**Files:**

- Modify: `src/lib/components/bento/CarnetAllergens.svelte`
- Modify: `src/lib/components/bento/CarnetAllergens.test.ts`
- Modify: `src/lib/components/bento/CarnetBento.svelte`

The pill currently renders three states (`'cleared' | 'todo' | 'reaction'`). We widen the union to include `'fading'`, render a peach-tinted list-item background plus a peach pill labeled "à reproposer", and substitute the caption's date with a "{days} j" days-since suffix when fading.

- [ ] **Step 1: Write the failing component test**

Open `src/lib/components/bento/CarnetAllergens.test.ts`. Inside `describe('CarnetAllergens', ...)`, add a new test at the end:

```ts
it("renders the 'fading' state with à reproposer pill and days caption", () => {
  const fading = [
    {
      id: 'oeuf',
      label: 'Œuf',
      triedCount: 1,
      lastTried: '2026-04-30',
      daysSinceLastTried: 5,
      state: 'fading' as const
    }
  ];
  render(CarnetAllergens, { props: { items: fading } });
  expect(screen.getByText('Œuf')).toBeTruthy();
  expect(screen.getByText(/à reproposer/i)).toBeTruthy();
  // Caption substitutes the date with the days-since suffix.
  expect(screen.getByText(/5 j/)).toBeTruthy();
});
```

The test introduces a new `daysSinceLastTried: number | null` field on the item shape — non-null only on fading items, null otherwise. The existing three tests at the top of this file currently omit the field; that is intentionally fine because the field is `number | null` on the widened type and the test fixtures rely on TypeScript's structural typing. You may, however, want to add `daysSinceLastTried: null` to each of the three existing fixtures to keep the test file's intent explicit — do this if `npx vitest run` flags any type errors in step 5 below.

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/components/bento/CarnetAllergens.test.ts -t "fading"
```

Expected: FAIL — either a type error (`'fading'` not assignable to `Item['state']`) or a missing-element error from Testing Library because the new label is not rendered.

- [ ] **Step 3: Widen `Item` and render the fading branch**

Open `src/lib/components/bento/CarnetAllergens.svelte`. Replace the whole `<script>` block with:

```svelte
<script lang="ts">
  import { Sparkles } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  type Item = {
    id: string;
    label: string;
    triedCount: number;
    lastTried: string | null;
    daysSinceLastTried: number | null;
    state: 'cleared' | 'todo' | 'reaction' | 'fading';
  };

  let { items }: { items: Item[] } = $props();

  function stateLabel(s: Item['state']): string {
    if (s === 'cleared') return m.aujourdhuiAllergensOk();
    if (s === 'reaction') return 'réaction';
    if (s === 'fading') return m.aujourdhuiAllergensFading();
    return m.aujourdhuiAllergensTodo();
  }

  function caption(it: Item): string {
    if (it.state === 'fading' && it.daysSinceLastTried !== null) {
      return `${it.triedCount}× · ${m.carnetAllergensFadingCaption({ days: String(it.daysSinceLastTried) })}`;
    }
    return `${it.triedCount}× · ${it.lastTried ?? '—'}`;
  }
</script>
```

Then replace the existing `<li>` so the fading state colours the list item AND the pill:

```svelte
{:else}
  <ul class="flex flex-col gap-2">
    {#each items as item (item.id)}
      <li
        class={cn(
          'flex items-center justify-between rounded-tile border border-border/40 bg-canvas p-3 shadow-soft',
          item.state === 'reaction' && 'border-severe/40 bg-tile-coral/20',
          item.state === 'fading' && 'border-tile-peach-foreground/30 bg-tile-peach/20'
        )}
      >
        <div>
          <p class="text-sm font-bold leading-tight">{item.label}</p>
          <p class="text-xs text-ink-soft">
            {caption(item)}
          </p>
        </div>
        <span
          class={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            item.state === 'cleared' && 'bg-tile-mint',
            item.state === 'todo' && 'bg-tile-butter',
            item.state === 'reaction' && 'bg-tile-coral text-tile-coral-foreground',
            item.state === 'fading' && 'bg-tile-peach'
          )}
        >
          {stateLabel(item.state)}
        </span>
      </li>
    {/each}
  </ul>
{/if}
```

(The `{#if items.length === 0}` branch above this `{:else}` is unchanged.)

- [ ] **Step 4: Widen the duplicated type in `CarnetBento.svelte`**

Open `src/lib/components/bento/CarnetBento.svelte`. Find the `type AllergenItem = { ... }` block (around line 19) and replace it with:

```svelte
  type AllergenItem = {
    id: string;
    label: string;
    triedCount: number;
    lastTried: string | null;
    daysSinceLastTried: number | null;
    state: 'cleared' | 'todo' | 'reaction' | 'fading';
  };
```

No other changes needed here — this component only passes the items through to `CarnetAllergens`.

- [ ] **Step 5: Run the new test to verify it passes**

```bash
npx vitest run src/lib/components/bento/CarnetAllergens.test.ts
```

Expected: all 4 tests pass (3 existing + 1 new fading test).

- [ ] **Step 6: Run the wider component test suite**

```bash
npx vitest run src/lib/components/bento
```

Expected: PASS across the bento components. No regressions in `CarnetBento.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/bento/CarnetAllergens.svelte \
        src/lib/components/bento/CarnetAllergens.test.ts \
        src/lib/components/bento/CarnetBento.svelte
git commit -m "feat(carnet-allergens): render 'fading' state with peach pill

A fourth state on the carnet allergens pill, used for priority
allergens whose maintenance cadence has slipped past four days.
Pill says 'à reproposer'; the caption substitutes the lastTried
date with a {days} j suffix. Butter is reserved for 'todo'; peach
is the calm-attention slot."
```

---

## Task 3: Derive `'fading'` in `loadBentoAllergens`

**Files:**

- Modify: `src/routes/child/[id]/foods/+page.server.ts`
- Modify: `src/routes/child/[id]/foods/page.server.test.ts`

The bento now _renders_ the fading state, but nothing in the loader produces it. This task wires up the derivation. The fading rule:

```
'fading' iff:
  - the allergen has at least one log (so triedCount >= 1)
  - the allergen is in PRIORITY_INTRODUCTION_ALLERGENS
  - the worst reaction is not 'reaction'  (reaction trumps fading)
  - daysSince(latest) > 4
```

`daysSinceLastTried` (an integer) is included on the returned item.

- [ ] **Step 1: Write the failing derivation tests**

Open `src/routes/child/[id]/foods/page.server.test.ts`. Look at the existing `setup` / `log` helpers (the file already creates Carotte and Pomme); we extend the pattern to seed an egg food so we can exercise the priority-allergen path.

Add a new `describe` block at the end of the file:

```ts
describe('bentoAllergens fading state', () => {
  async function setupEgg() {
    const base = await setup();
    const egg = (
      await testDb
        .insert(foods)
        .values({
          name: 'Œuf',
          category: 'oeufs',
          isMajorAllergen: true,
          allergenType: 'oeuf',
          suggestedAgeMonths: 6,
          notes: null,
          isCustom: false,
          customForChildId: null
        })
        .returning()
    )[0];
    const celery = (
      await testDb
        .insert(foods)
        .values({
          name: 'Céleri',
          category: 'legumes',
          isMajorAllergen: false,
          allergenType: 'celeri',
          suggestedAgeMonths: 9,
          notes: null,
          isCustom: false,
          customForChildId: null
        })
        .returning()
    )[0];
    return { ...base, egg, celery };
  }

  it("returns 'fading' for a priority allergen logged > 4 days ago with no reaction", async () => {
    const ctx = await setupEgg();
    await ctx.log(ctx.egg.id, 'ras', /* daysAgo */ 5);
    const res = await loadFor(ctx, 'http://x/child/1/foods?segment=allergens');
    const oeuf = res.bentoAllergens.find((a: { id: string }) => a.id === 'oeuf');
    expect(oeuf?.state).toBe('fading');
    expect(oeuf?.daysSinceLastTried).toBe(5);
  });

  it("returns 'cleared' for a priority allergen logged <= 4 days ago", async () => {
    const ctx = await setupEgg();
    await ctx.log(ctx.egg.id, 'ras', 3);
    const res = await loadFor(ctx, 'http://x/child/1/foods?segment=allergens');
    const oeuf = res.bentoAllergens.find((a: { id: string }) => a.id === 'oeuf');
    expect(oeuf?.state).toBe('cleared');
  });

  it("keeps 'reaction' state even if last log is > 4 days ago (reaction trumps fading)", async () => {
    const ctx = await setupEgg();
    await ctx.log(ctx.egg.id, 'reaction', 8);
    const res = await loadFor(ctx, 'http://x/child/1/foods?segment=allergens');
    const oeuf = res.bentoAllergens.find((a: { id: string }) => a.id === 'oeuf');
    expect(oeuf?.state).toBe('reaction');
  });

  it("does not mark non-priority allergens (céleri) as 'fading' regardless of gap", async () => {
    const ctx = await setupEgg();
    await ctx.log(ctx.celery.id, 'ras', 30);
    const res = await loadFor(ctx, 'http://x/child/1/foods?segment=allergens');
    const celeri = res.bentoAllergens.find((a: { id: string }) => a.id === 'celeri');
    expect(celeri?.state).toBe('cleared');
  });

  it("returns 'todo' for a priority allergen never logged", async () => {
    const ctx = await setupEgg();
    const res = await loadFor(ctx, 'http://x/child/1/foods?segment=allergens');
    const arachide = res.bentoAllergens.find((a: { id: string }) => a.id === 'arachide');
    expect(arachide?.state).toBe('todo');
  });
});
```

These tests use the existing `setup`, `log`, and `loadFor` helpers from the top of the file. No top-level imports change — `foods` is already imported on line 13.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/routes/child/\[id\]/foods/page.server.test.ts -t "fading state"
```

Expected: FAIL on the first test ("returns 'fading' for a priority allergen logged > 4 days ago"), because the loader still returns `'cleared'`. The "fading" string is not yet a member of the union, so `expect(...).toBe('fading')` will also produce a type error visible in the run.

- [ ] **Step 3: Widen `AllergenItem` and derive `'fading'`**

Open `src/routes/child/[id]/foods/+page.server.ts`. Replace lines 5–14 (the `AllergenItem` type and the `formatDDMMYY` helper) with:

```ts
import { ALLERGENS, PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';
import type { PageServerLoad } from './$types';

export type AllergenItem = {
  id: string;
  label: string;
  triedCount: number;
  lastTried: string | null;
  daysSinceLastTried: number | null;
  state: 'cleared' | 'todo' | 'reaction' | 'fading';
};

const DAY_MS = 24 * 60 * 60 * 1000;
const FADING_THRESHOLD_DAYS = 4;
const PRIORITY_SET = new Set<string>(PRIORITY_INTRODUCTION_ALLERGENS);

function formatDDMMYY(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(d.getUTCFullYear() % 100).padStart(2, '0');
  return `${dd}/${mm}/${yy}`;
}
```

Then replace the `loadBentoAllergens` function (currently lines 23–69) entirely with:

```ts
async function loadBentoAllergens(
  childId: number,
  now: Date = new Date()
): Promise<AllergenItem[]> {
  const rows = await db
    .select({
      allergenType: foods.allergenType,
      givenAt: foodEntries.givenAt,
      reaction: foodEntries.reaction
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(and(eq(foodEntries.childId, childId), isNotNull(foods.allergenType)));

  const byAllergen = new Map<string, { triedCount: number; latest: Date; hasReaction: boolean }>();
  for (const r of rows) {
    /* v8 ignore next */
    if (!r.allergenType) continue;
    const givenAt =
      r.givenAt instanceof Date ? r.givenAt : /* v8 ignore next */ new Date(Number(r.givenAt));
    const bucket = byAllergen.get(r.allergenType);
    if (bucket) {
      bucket.triedCount += 1;
      if (givenAt.getTime() > bucket.latest.getTime()) bucket.latest = givenAt;
      if (r.reaction === 'reaction') bucket.hasReaction = true;
    } else {
      byAllergen.set(r.allergenType, {
        triedCount: 1,
        latest: givenAt,
        hasReaction: r.reaction === 'reaction'
      });
    }
  }

  return ALLERGENS.map((a) => {
    const b = byAllergen.get(a.id);
    if (!b) {
      return {
        id: a.id,
        label: a.label,
        triedCount: 0,
        lastTried: null,
        daysSinceLastTried: null,
        state: 'todo' as const
      };
    }
    const daysSince = Math.max(0, Math.floor((now.getTime() - b.latest.getTime()) / DAY_MS));
    const isPriority = PRIORITY_SET.has(a.id);
    let state: AllergenItem['state'];
    if (b.hasReaction) {
      state = 'reaction';
    } else if (isPriority && daysSince > FADING_THRESHOLD_DAYS) {
      state = 'fading';
    } else {
      state = 'cleared';
    }
    return {
      id: a.id,
      label: a.label,
      triedCount: b.triedCount,
      lastTried: formatDDMMYY(b.latest),
      daysSinceLastTried: daysSince,
      state
    };
  });
}
```

- [ ] **Step 4: Run the fading-state tests to verify they pass**

```bash
npx vitest run src/routes/child/\[id\]/foods/page.server.test.ts -t "fading state"
```

Expected: PASS — all 5 new tests green.

- [ ] **Step 5: Run the whole foods route test suite to check for regressions**

```bash
npx vitest run src/routes/child/\[id\]/foods/page.server.test.ts
```

Expected: PASS across the whole file. If a pre-existing test checks the exact shape of an `AllergenItem` (e.g. `toEqual({...})` without `daysSinceLastTried`), update it to either add the field or use `expect.objectContaining(...)` — the new field is additive and should not change observable behavior in those tests.

- [ ] **Step 6: Commit**

```bash
git add src/routes/child/\[id\]/foods/+page.server.ts \
        src/routes/child/\[id\]/foods/page.server.test.ts
git commit -m "feat(foods): derive 'fading' state in loadBentoAllergens

When a priority allergen has been logged at least once with no
reaction history and the most recent log is more than four days old,
mark the bento item 'fading' and surface the days-since count.
Reaction always wins over fading. Non-priority allergens (céleri,
moutarde, crustacés, mollusques, soja) are never marked fading."
```

---

## Task 4: Add rule 9 `maintain-allergen` to the reminders engine

**Files:**

- Modify: `src/lib/server/guidance/reminders.ts`
- Modify: `src/lib/server/guidance/reminders.test.ts`

The dashboard reminder rail consumes `computeReminders`. Rule 9 emits at most 2 `info`-severity cards, one per priority allergen whose last exposure is older than four days. Cards are sorted oldest-exposure-first so the most-stale allergen is surfaced first.

- [ ] **Step 1: Write the failing rule 9 tests**

Open `src/lib/server/guidance/reminders.test.ts`. After the existing top-level `describe('computeReminders', ...)` blocks, add a new `describe` block inside the same outer `describe`:

```ts
describe('maintain-allergen', () => {
  // Helper: build an entry for an allergen-bearing food. The reminders engine
  // sees EnrichedEntry.allergenType and uses it to identify allergen logs.
  function allergenEntry(
    allergen: AllergenId,
    daysAgo: number,
    overrides: Partial<EnrichedEntry> = {}
  ): EnrichedEntry {
    return entry({
      foodName: allergen,
      allergenType: allergen,
      givenAt: NOW - daysAgo * DAY,
      reaction: 'ras',
      ...overrides
    });
  }

  it('does not fire when the last exposure is within 4 days', () => {
    const out = computeReminders(
      isolated({
        introducedAllergens: new Set<AllergenId>(['oeuf']),
        entries: [allergenEntry('oeuf', 3)]
      })
    );
    expect(out.find((r) => r.key === 'maintain-allergen:oeuf')).toBeUndefined();
  });

  it('fires when the last exposure is older than 4 days', () => {
    const out = computeReminders(
      isolated({
        introducedAllergens: new Set<AllergenId>(['oeuf']),
        entries: [allergenEntry('oeuf', 5)]
      })
    );
    const card = out.find((r) => r.key === 'maintain-allergen:oeuf');
    expect(card).toBeDefined();
    expect(card?.severity).toBe('info');
  });

  it('caps at 2 cards sorted oldest-exposure-first', () => {
    const out = computeReminders(
      isolated({
        introducedAllergens: new Set<AllergenId>(['oeuf', 'arachide', 'lait']),
        entries: [allergenEntry('oeuf', 6), allergenEntry('arachide', 9), allergenEntry('lait', 7)]
      })
    );
    const keys = out.filter((r) => r.key.startsWith('maintain-allergen:')).map((r) => r.key);
    expect(keys).toEqual(['maintain-allergen:arachide', 'maintain-allergen:lait']);
  });

  it('does not fire for non-priority allergens (céleri)', () => {
    const out = computeReminders(
      isolated({
        introducedAllergens: new Set<AllergenId>(['celeri']),
        entries: [allergenEntry('celeri', 30)]
      })
    );
    expect(out.find((r) => r.key.startsWith('maintain-allergen:'))).toBeUndefined();
  });

  it('does not fire if the priority allergen was never introduced', () => {
    // No entries at all → introducedAllergens cannot include the allergen.
    const out = computeReminders(
      isolated({
        introducedAllergens: new Set<AllergenId>(), // override the isolated()
        entries: []
      })
    );
    expect(out.find((r) => r.key.startsWith('maintain-allergen:'))).toBeUndefined();
  });

  it('respects dismissal of maintain-allergen:<id>', () => {
    const out = computeReminders(
      isolated({
        introducedAllergens: new Set<AllergenId>(['oeuf']),
        entries: [allergenEntry('oeuf', 7)],
        dismissals: new Set<string>(['maintain-allergen:oeuf'])
      })
    );
    expect(out.find((r) => r.key === 'maintain-allergen:oeuf')).toBeUndefined();
  });

  it('lets reaction-state allergens still surface their pending-reaction context, but does not also emit a maintain card', () => {
    const out = computeReminders(
      isolated({
        introducedAllergens: new Set<AllergenId>(['oeuf']),
        entries: [allergenEntry('oeuf', 8, { reaction: 'reaction' })]
      })
    );
    expect(out.find((r) => r.key === 'maintain-allergen:oeuf')).toBeUndefined();
  });

  it('sorts maintain cards below important + warn severity in the final list', () => {
    const out = computeReminders(
      input({
        ageMonths: 6, // triggers stage-transition:6m (important)
        introducedAllergens: new Set<AllergenId>(['oeuf']),
        entries: [allergenEntry('oeuf', 6)]
      })
    );
    const idxImportant = out.findIndex((r) => r.key === 'stage-transition:6m');
    const idxMaintain = out.findIndex((r) => r.key === 'maintain-allergen:oeuf');
    expect(idxImportant).toBeGreaterThanOrEqual(0);
    if (idxMaintain >= 0) {
      expect(idxMaintain).toBeGreaterThan(idxImportant);
    }
  });
});
```

These tests rely on the existing `entry()`, `input()`, `isolated()` factories and the `NOW`, `DAY`, `ALL_ALLERGENS` constants already declared at the top of the file. They use `AllergenId` from `$lib/utils/allergens` which is already imported on line 4.

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run src/lib/server/guidance/reminders.test.ts -t "maintain-allergen"
```

Expected: FAIL — every test fails because rule 9 does not exist yet, so no `maintain-allergen:*` keys are produced.

- [ ] **Step 3: Add rule 9 to `reminders.ts`**

Open `src/lib/server/guidance/reminders.ts`. At the top of the file, immediately after the existing `const ALLERGEN_PRIORITY` line, add a constant:

```ts
const MAINTAIN_THRESHOLD_DAYS = 4;
const MAINTAIN_CARD_CAP = 2;
```

Then, inside `computeReminders`, immediately after rule 8 (the honey check, ending with the closing `}` for `if (input.ageMonths < 12) { ... }`), insert rule 9 BEFORE the `// Sort by severity, cap to top 4` block:

```ts
// 9. Maintain priority allergens: once a priority allergen has been
// introduced, surface a calm nudge if more than four days have passed
// since the last exposure. Anchored to the LEAP/ESPGHAN target of
// 2-3 times per week. Reaction-bearing allergens are suppressed here so
// we never compete with the reaction surfaces.
if (input.ageMonths >= 4) {
  type MaintainCandidate = { id: AllergenId; daysSince: number; lastAt: number };
  const lastByAllergen = new Map<AllergenId, number>();
  const hasReactionByAllergen = new Map<AllergenId, boolean>();
  for (const e of input.entries) {
    if (!e.allergenType) continue;
    const aid = e.allergenType as AllergenId;
    if (!ALLERGEN_PRIORITY.includes(aid)) continue;
    const cur = lastByAllergen.get(aid);
    if (cur == null || e.givenAt > cur) lastByAllergen.set(aid, e.givenAt);
    if (e.reaction === 'reaction') hasReactionByAllergen.set(aid, true);
  }
  const candidates: MaintainCandidate[] = [];
  for (const id of ALLERGEN_PRIORITY) {
    if (!input.introducedAllergens.has(id)) continue;
    if (hasReactionByAllergen.get(id)) continue;
    const lastAt = lastByAllergen.get(id);
    if (lastAt == null) continue; // introduced but no allergenType-tagged entry in window
    const daysSince = Math.max(0, Math.floor((now - lastAt) / DAY_MS));
    if (daysSince > MAINTAIN_THRESHOLD_DAYS) {
      candidates.push({ id, daysSince, lastAt });
    }
  }
  // Sort oldest exposure first (largest daysSince first), cap to MAINTAIN_CARD_CAP.
  candidates.sort((a, b) => b.daysSince - a.daysSince);
  for (const c of candidates.slice(0, MAINTAIN_CARD_CAP)) {
    const label = ALLERGEN_LABELS[c.id];
    push(out, input.dismissals, {
      key: `maintain-allergen:${c.id}`,
      severity: 'info',
      title: `Reproposez « ${label} »`,
      body: `Bébé n'a pas eu ${label.toLowerCase()} depuis ${c.daysSince} jours. L'idéal est d'en reproposer 2 à 3 fois par semaine pour entretenir la tolérance.`,
      cta: { label: 'Voir les suggestions', href: `${childPath}/suggestions?allergen=${c.id}` },
      sources: ['leap-2015', 'espghan-2017', 'anses-nourrisson'],
      dismissable: true
    });
  }
}
```

The rule lives inside the existing `computeReminders` function and shares its locals (`now`, `out`, `childPath`, `input`, `DAY_MS`). Confirm by skimming the surrounding code that those names are in scope where you insert the block.

- [ ] **Step 4: Run the rule 9 tests to verify they pass**

```bash
npx vitest run src/lib/server/guidance/reminders.test.ts -t "maintain-allergen"
```

Expected: PASS — all 8 new tests green.

- [ ] **Step 5: Run the whole reminders test file**

```bash
npx vitest run src/lib/server/guidance/reminders.test.ts
```

Expected: PASS — no regression in the previous rules. Pay special attention to the existing "stale-diversity" + "repeat-exposure" tests, since maintain-allergen also reasons about entry recency; if either of those previously assumed there would be at most N cards in the output, the 4-card cap still protects them (info severity sorts last).

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/guidance/reminders.ts \
        src/lib/server/guidance/reminders.test.ts
git commit -m "feat(reminders): rule 9 maintain-allergen card

Emit a calm 'Reproposez « X »' card on the dashboard reminder rail
once a priority allergen has not been re-exposed in more than four
days. Severity info, cap at 2 cards sorted oldest-first, dismissable.
Anchored to LEAP/ESPGHAN/ANSES sources."
```

---

## Task 5: Verification pass

**Files:**

(no edits expected — this is a guard rail)

- [ ] **Step 1: Full vitest run**

```bash
npm test
```

Expected: PASS across the whole suite. If anything red turns up, fix in place — do not skip tests.

- [ ] **Step 2: TypeScript check**

```bash
npx svelte-check --tsconfig ./tsconfig.json
```

Expected: 0 errors, 0 warnings on the new code. If svelte-check is not the project's preferred command, fall back to:

```bash
npm run check
```

Look at `package.json` "scripts" to confirm.

- [ ] **Step 3: Lint**

```bash
npx eslint src/lib/components/bento/CarnetAllergens.svelte \
           src/lib/components/bento/CarnetBento.svelte \
           src/lib/server/guidance/reminders.ts \
           src/lib/server/guidance/reminders.test.ts \
           "src/routes/child/[id]/foods/+page.server.ts" \
           "src/routes/child/[id]/foods/page.server.test.ts"
```

Expected: no errors. (Pre-commit already ran prettier + eslint on staged files; this is the belt-and-braces.)

- [ ] **Step 4: E2E smoke (optional, if Playwright fixtures cover the foods route)**

```bash
npm run test:e2e -- --grep "foods|allergen"
```

Expected: PASS. The DB is reset by the test:e2e script before the run, so seeded data starts fresh. If there are no Playwright tests covering this surface, skip this step — do not invent flaky tests just to "tick the box".

- [ ] **Step 5: Manual verification (recommended)**

Start the dev server:

```bash
npm run dev
```

In a browser, sign in, open `/child/<id>/foods?segment=allergens`. Log an egg (Œuf), then change the entry's `givenAt` to >4 days ago via the entry detail page (or directly in psql) and reload. Expect:

- The Œuf card has a peach-tinted background.
- The pill says "à reproposer".
- The caption shows e.g. "1× · 5 j".

Then open `/child/<id>` (dashboard). Expect a card titled "Reproposez « Œuf »" in the reminders rail. Dismiss it — verify it disappears. Wait or re-trigger the dismissal TTL window to confirm it can re-surface (info dismissals last 30 days; for a quick reset, delete the row from `tip_dismissals` in psql).

- [ ] **Step 6: Final commit (only if step 5 surfaced any fix)**

If you found a visual or wording tweak during manual verification:

```bash
git add <files>
git commit -m "fix(allergen-maintenance): <what was off>

<short why>"
```

If nothing needed fixing, no commit — the slice is done.

---

## Self-review checklist (run once, fix inline)

After completing all tasks, verify:

- The four `state` unions are consistent: all four files declare `'cleared' | 'todo' | 'reaction' | 'fading'`.
- The threshold constant is `4` (days) in both `reminders.ts` (`MAINTAIN_THRESHOLD_DAYS`) and `+page.server.ts` (`FADING_THRESHOLD_DAYS`). They are intentionally duplicated rather than centralized because the bento and the reminders engine could legitimately diverge in the future, and a shared constant would create false coupling. If the spec changes the threshold, BOTH need updating.
- `daysSinceLastTried` is non-null only on items whose `lastTried` is non-null. The bento renderer asserts this implicitly by checking `it.state === 'fading' && it.daysSinceLastTried != null`.
- Hard-coded reminder strings in `reminders.ts` use « », `'` (typographic apostrophe), and `–` (en-dash) consistent with the file's existing rules.
- `MAINTAIN_CARD_CAP = 2` is respected in the test "caps at 2 cards" and produces exactly two `maintain-allergen:*` keys when three slips are present.
- No commit was made with `--no-verify`.
