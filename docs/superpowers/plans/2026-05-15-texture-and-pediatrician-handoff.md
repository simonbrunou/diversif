# Texture Progression + Bilan pour le pédiatre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a nullable `texture` field on every food log entry with a stage-driven default UI, and extend `/child/[id]/report` into a print-ready _« Bilan pour le pédiatre »_ (priority-allergen status, stage status, 30-day texture distribution, print stylesheet).

**Architecture:** Two PRs, sequenced. PR 1 ships the texture column and its picker / surfaces. PR 2 extends the existing report loader and route — it does **not** introduce a new route, does **not** add a server-side PDF dependency, and does **not** use `loadBentoAllergens` (the existing report rollup already exposes per-allergen `status`/`worst`/`exposures`/`firstGivenAt`/`lastGivenAt` — we add an `isPriority` flag on top instead of a parallel data path).

**Tech Stack:** SvelteKit (Svelte 5 runes), Drizzle ORM, Postgres (pg-mem in tests), Zod, Tailwind, paraglide i18n, vitest + Playwright.

**Spec:** `docs/superpowers/specs/2026-05-15-texture-and-pediatrician-handoff-design.md`.

---

## File Structure

**PR 1 — Texture progression**

- Create: `src/lib/utils/textures.ts` — `TEXTURE_VALUES`, `TextureKey`, `defaultTextureForAgeMonths()`, `getTextureLabel()`.
- Create: `drizzle/0005_food_entry_texture.sql` — `ALTER TABLE` + `CHECK`.
- Modify: `src/lib/server/db/schema.ts:122–145` — add `texture` column.
- Modify: `src/routes/child/[id]/log/+page.server.ts` — extend Zod schema; persist texture; default by age.
- Modify: `src/routes/child/[id]/log/+page.svelte` — render `TexturePicker`; bind default.
- Create: `src/lib/components/TexturePicker.svelte` — 6-card single-select + Ø clear chip.
- Modify: `src/routes/child/[id]/foods/+page.server.ts` — return `texture` in feed entries.
- Modify: `src/routes/child/[id]/foods/+page.svelte` — render texture tag on feed rows.
- Modify: `src/routes/child/[id]/foods/[entryId]/+page.server.ts` — return texture in `loadEntryForChild()`.
- Modify: `src/routes/child/[id]/foods/[entryId]/+page.svelte` — render texture row in header.
- Modify: `src/routes/child/[id]/foods/[entryId]/edit/+page.svelte` (and its server) — texture in edit form.
- Modify: `src/lib/components/bento/CarnetStats.svelte` (+ its loader) — _« Textures explorées »_ tile.
- Modify: `messages/fr.json`, `messages/en.json` — texture keys.
- Modify: `e2e/log.spec.ts` (or nearest equivalent — confirm during Task 9).
- Create: `drizzle/migrations.test.ts` — migration smoke.
- Modify: `src/routes/child/[id]/log/page.server.test.ts:97`+ — texture form-action tests.
- Modify: `src/routes/child/[id]/foods/[entryId]/page.server.test.ts` — texture in payload.

**PR 2 — Bilan pour le pédiatre**

- Modify: `src/routes/child/[id]/report/+page.server.ts:31–181` — add `isPriority`, sort, stage status, texture distribution.
- Modify: `src/routes/child/[id]/report/+page.svelte` — render new sections + _« Imprimer »_ button + print stylesheet.
- Modify: `src/lib/components/Sidebar.svelte` (or wherever the report nav link lives — confirm during Task 14) — rename label.
- Modify: `messages/fr.json`, `messages/en.json` — report keys.
- Modify: `src/routes/child/[id]/report/page.server.test.ts` — priority ordering, stage gap, distribution.
- Modify: `e2e/report.spec.ts` (or create) — WebKit print smoke.

---

# PR 1 — Texture progression

## Task 1: Texture utils module + types

**Files:**

- Create: `src/lib/utils/textures.ts`
- Create: `src/lib/utils/textures.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/utils/textures.test.ts
import { describe, expect, it } from 'vitest';
import {
  TEXTURE_VALUES,
  defaultTextureForAgeMonths,
  getTextureLabel,
  isTextureKey
} from './textures';

describe('textures', () => {
  it('TEXTURE_VALUES is the 6 known keys in progression order, finger last', () => {
    expect(TEXTURE_VALUES).toEqual([
      'lisse',
      'moulinee',
      'ecrasee',
      'petits-morceaux',
      'morceaux',
      'finger'
    ]);
  });

  it('isTextureKey accepts known keys and rejects unknown', () => {
    expect(isTextureKey('lisse')).toBe(true);
    expect(isTextureKey('finger')).toBe(true);
    expect(isTextureKey('foo')).toBe(false);
    expect(isTextureKey(null)).toBe(false);
  });

  it('defaultTextureForAgeMonths maps ranges deterministically', () => {
    expect(defaultTextureForAgeMonths(3)).toBe('lisse'); // below window: clamp to lisse
    expect(defaultTextureForAgeMonths(4)).toBe('lisse');
    expect(defaultTextureForAgeMonths(5.9)).toBe('lisse');
    expect(defaultTextureForAgeMonths(6)).toBe('moulinee');
    expect(defaultTextureForAgeMonths(6.9)).toBe('moulinee');
    expect(defaultTextureForAgeMonths(7)).toBe('ecrasee');
    expect(defaultTextureForAgeMonths(8.9)).toBe('ecrasee');
    expect(defaultTextureForAgeMonths(9)).toBe('petits-morceaux');
    expect(defaultTextureForAgeMonths(11.9)).toBe('petits-morceaux');
    expect(defaultTextureForAgeMonths(12)).toBe('morceaux');
    expect(defaultTextureForAgeMonths(36)).toBe('morceaux');
  });

  it('defaultTextureForAgeMonths never returns finger (finger is opt-in)', () => {
    for (let m = 0; m <= 48; m += 0.5) {
      expect(defaultTextureForAgeMonths(m)).not.toBe('finger');
    }
  });

  it('getTextureLabel returns the FR label', () => {
    expect(getTextureLabel('lisse')).toBe('Lisse');
    expect(getTextureLabel('petits-morceaux')).toBe('Petits morceaux');
    expect(getTextureLabel('finger')).toBe('Finger food');
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx vitest run src/lib/utils/textures.test.ts`
Expected: FAIL — file `./textures` does not exist.

- [ ] **Step 3: Implement the module**

```ts
// src/lib/utils/textures.ts
export const TEXTURE_VALUES = [
  'lisse',
  'moulinee',
  'ecrasee',
  'petits-morceaux',
  'morceaux',
  'finger'
] as const;

export type TextureKey = (typeof TEXTURE_VALUES)[number];

const LABELS: Record<TextureKey, string> = {
  lisse: 'Lisse',
  moulinee: 'Moulinée',
  ecrasee: 'Écrasée',
  'petits-morceaux': 'Petits morceaux',
  morceaux: 'Morceaux',
  finger: 'Finger food'
};

export function getTextureLabel(key: TextureKey): string {
  return LABELS[key];
}

export function isTextureKey(value: unknown): value is TextureKey {
  return typeof value === 'string' && (TEXTURE_VALUES as readonly string[]).includes(value);
}

/**
 * Age-by-month → default texture for the log sheet pre-selection.
 * `finger` is parallel/opt-in and never returned as a default.
 */
export function defaultTextureForAgeMonths(months: number): TextureKey {
  if (months < 6) return 'lisse';
  if (months < 7) return 'moulinee';
  if (months < 9) return 'ecrasee';
  if (months < 12) return 'petits-morceaux';
  return 'morceaux';
}
```

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx vitest run src/lib/utils/textures.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/textures.ts src/lib/utils/textures.test.ts
git commit -m "feat(texture): add textures util module + tests"
```

---

## Task 2: Schema column + migration + migration test

**Files:**

- Modify: `src/lib/server/db/schema.ts:137`
- Create: `drizzle/0005_food_entry_texture.sql`
- Create: `drizzle/0005_food_entry_texture.test.ts` (or extend existing migration test, confirm during step 1)

- [ ] **Step 1: Locate the existing migration test pattern**

Run: `find drizzle -name '*.test.ts' -o -name '*.spec.ts' 2>/dev/null; grep -rn 'CREATE TABLE\|ALTER TABLE' src/lib/server/db 2>/dev/null | head`

If a per-migration test file already exists, follow its pattern. Otherwise the project uses pg-mem at test boot via `resetTestDb()` (see `src/lib/server/db/__tests__/` or `e2e/helpers`) — create a new `src/lib/server/db/__tests__/migration-0005.test.ts` mirroring the closest existing migration test.

- [ ] **Step 2: Write the failing migration test**

```ts
// src/lib/server/db/__tests__/migration-0005.test.ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetTestDb, getTestDb } from '$lib/server/db/test-helpers';
import { sql } from 'drizzle-orm';

describe('migration 0005 — food_entries.texture', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('adds nullable texture column constrained to known values', async () => {
    const db = getTestDb();

    // column exists, nullable
    const cols = await db.execute(sql`
      SELECT column_name, is_nullable
        FROM information_schema.columns
       WHERE table_name = 'food_entries' AND column_name = 'texture'
    `);
    expect(cols.rows ?? cols).toHaveLength(1);

    // accepts known values via direct insert (use any other required cols)
    // — exact fixture composition lifted from src/routes/child/[id]/log/page.server.test.ts
    // setup helper. Skip here if helper isn't reusable; the CHECK test below is the
    // load-bearing assertion.

    // rejects unknown value
    await expect(
      db.execute(sql`
        INSERT INTO food_entries (child_id, food_id, given_at, reaction, created_at, texture)
        VALUES (1, 1, NOW(), 'ras', NOW(), 'not-a-texture')
      `)
    ).rejects.toThrow(/check|texture/i);
  });
});
```

- [ ] **Step 3: Run the test, verify it fails**

Run: `npx vitest run src/lib/server/db/__tests__/migration-0005.test.ts`
Expected: FAIL — column does not exist.

- [ ] **Step 4: Add the schema column**

In `src/lib/server/db/schema.ts:137` (the `reaction` line), add `texture` immediately after:

```ts
    reaction: text('reaction', { enum: ['ras', 'inconfort', 'reaction'] }).notNull(),
    texture: text('texture', {
      enum: ['lisse', 'moulinee', 'ecrasee', 'petits-morceaux', 'morceaux', 'finger']
    }),
    notes: text('notes'),
```

- [ ] **Step 5: Write the migration SQL**

```sql
-- drizzle/0005_food_entry_texture.sql
ALTER TABLE food_entries
  ADD COLUMN texture TEXT
  CHECK (texture IN ('lisse', 'moulinee', 'ecrasee', 'petits-morceaux', 'morceaux', 'finger'));
```

- [ ] **Step 6: Run the migration test, verify it passes**

Run: `npx vitest run src/lib/server/db/__tests__/migration-0005.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full test suite to catch regressions**

Run: `npm test`
Expected: all green. If any test inserts into `food_entries` and asserts on its full row shape, fix the assertion to allow `texture: null`.

- [ ] **Step 8: Commit**

```bash
git add drizzle/0005_food_entry_texture.sql src/lib/server/db/schema.ts \
        src/lib/server/db/__tests__/migration-0005.test.ts
git commit -m "feat(texture): add nullable food_entries.texture column with check constraint"
```

---

## Task 3: Form action accepts and persists `texture`

**Files:**

- Modify: `src/routes/child/[id]/log/+page.server.ts:17–28` (Zod schema) and `:194–202` (insert payload)
- Modify: `src/routes/child/[id]/log/page.server.test.ts` (add new tests after the existing 97-line failure case)

- [ ] **Step 1: Write the failing tests**

In `src/routes/child/[id]/log/page.server.test.ts`, append these tests inside the existing describe block (after the L97–150 invalid-payload test):

```ts
it('persists a valid texture when provided', async () => {
  const ctx = await setup();
  const form = new FormData();
  form.set('foodId', String(ctx.foodId));
  form.set('givenAt', new Date().toISOString());
  form.set('reaction', 'ras');
  form.set('texture', 'ecrasee');
  const event = makeFormEvent({ form, params: { id: String(ctx.childId) }, locals: ctx.locals });
  const result = await actions.default(event);
  expect(result).toBeUndefined(); // redirect thrown, not returned
  const rows = await ctx.testDb
    .select()
    .from(foodEntries)
    .where(eq(foodEntries.childId, ctx.childId));
  expect(rows[0].texture).toBe('ecrasee');
});

it('persists null texture when omitted', async () => {
  const ctx = await setup();
  const form = new FormData();
  form.set('foodId', String(ctx.foodId));
  form.set('givenAt', new Date().toISOString());
  form.set('reaction', 'ras');
  const event = makeFormEvent({ form, params: { id: String(ctx.childId) }, locals: ctx.locals });
  await actions.default(event);
  const rows = await ctx.testDb
    .select()
    .from(foodEntries)
    .where(eq(foodEntries.childId, ctx.childId));
  expect(rows[0].texture).toBeNull();
});

it('rejects an invalid texture value with 400', async () => {
  const ctx = await setup();
  const form = new FormData();
  form.set('foodId', String(ctx.foodId));
  form.set('givenAt', new Date().toISOString());
  form.set('reaction', 'ras');
  form.set('texture', 'not-a-texture');
  const event = makeFormEvent({ form, params: { id: String(ctx.childId) }, locals: ctx.locals });
  const result = await actions.default(event);
  expect(result).toMatchObject({ status: 400 });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `npx vitest run src/routes/child/[id]/log/page.server.test.ts`
Expected: FAIL — texture not in payload / schema doesn't validate it / insert ignores it.

- [ ] **Step 3: Extend the Zod schema and the insert**

In `src/routes/child/[id]/log/+page.server.ts`:

At the top of the file, add the import:

```ts
import { TEXTURE_VALUES } from '$lib/utils/textures';
```

Replace the Zod schema (L17–28) with:

```ts
const schema = z
  .object({
    foodId: z.coerce.number().int().positive().optional(),
    'customFood.name': z.string().min(1).max(80).optional(),
    'customFood.category': z.string().optional(),
    givenAt: z.string().min(1, 'Date requise'),
    reaction: z.enum(['ras', 'inconfort', 'reaction']),
    texture: z.enum(TEXTURE_VALUES).optional(),
    notes: z.string().max(2000).optional()
  })
  .refine((d) => !!d.foodId || !!d['customFood.name'], {
    message: 'Choisissez un aliment ou créez-en un.'
  });
```

In the `tx.insert(foodEntries).values({...})` block (L194–202), add `texture`:

```ts
await tx.insert(foodEntries).values({
  childId,
  foodId,
  givenAt: givenAtDate,
  reaction: parsed.data.reaction,
  texture: parsed.data.texture ?? null,
  notes: parsed.data.notes?.trim() || null,
  loggedBy: user.id,
  createdAt: new Date()
});
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `npx vitest run src/routes/child/[id]/log/page.server.test.ts`
Expected: PASS, all texture tests green.

- [ ] **Step 5: Commit**

```bash
git add src/routes/child/[id]/log/+page.server.ts src/routes/child/[id]/log/page.server.test.ts
git commit -m "feat(texture): accept and persist texture on log form action"
```

---

## Task 4: `TexturePicker.svelte` component

**Files:**

- Create: `src/lib/components/TexturePicker.svelte`

- [ ] **Step 1: Build the component**

Mirror the shape of `src/lib/components/ReactionPicker.svelte` — `fieldset` + `<input type="radio" class="sr-only">` per option, tinted card surface, focus ring via `has-[:focus-visible]`. Six cards in `grid grid-cols-3 gap-2 sm:grid-cols-6` (3 cols on phones, 6 wide on desktop). Use brand palette tile tokens (peach/butter/mint/sky/lilac/sage rotated through the 6 keys — colocate the mapping in the component, not in tokens). Caption hint _« par défaut pour {ageMonths} mois — modifiable »_ shown when `pristine` is `true` and `ageMonths` is provided.

```svelte
<!-- src/lib/components/TexturePicker.svelte -->
<script lang="ts">
  import { Check, X } from 'lucide-svelte';
  import { TEXTURE_VALUES, type TextureKey, getTextureLabel } from '$lib/utils/textures';
  import { cn } from '$lib/utils/cn';

  let {
    name,
    value = $bindable<TextureKey | null>(null),
    ageMonths,
    pristine = $bindable<boolean>(true)
  }: {
    name: string;
    value?: TextureKey | null;
    ageMonths?: number;
    pristine?: boolean;
  } = $props();

  // Tile tokens reused across the app (see PRODUCT.md palette).
  const TILE: Record<TextureKey, { tint: string; ring: string; text: string }> = {
    lisse: {
      tint: 'bg-tile-peach-200/40 border-tile-peach-200/60',
      ring: 'border-tile-peach-fg ring-tile-peach-200 bg-tile-peach-200/70',
      text: 'text-tile-peach-fg'
    },
    moulinee: {
      tint: 'bg-tile-butter-200/40 border-tile-butter-200/60',
      ring: 'border-tile-butter-fg ring-tile-butter-200 bg-tile-butter-200/70',
      text: 'text-tile-butter-fg'
    },
    ecrasee: {
      tint: 'bg-tile-mint-200/40 border-tile-mint-200/60',
      ring: 'border-tile-mint-fg ring-tile-mint-200 bg-tile-mint-200/70',
      text: 'text-tile-mint-fg'
    },
    'petits-morceaux': {
      tint: 'bg-tile-sky-200/40 border-tile-sky-200/60',
      ring: 'border-tile-sky-fg ring-tile-sky-200 bg-tile-sky-200/70',
      text: 'text-tile-sky-fg'
    },
    morceaux: {
      tint: 'bg-tile-lilac-200/40 border-tile-lilac-200/60',
      ring: 'border-tile-lilac-fg ring-tile-lilac-200 bg-tile-lilac-200/70',
      text: 'text-tile-lilac-fg'
    },
    finger: {
      tint: 'bg-primary/5 border-primary/20',
      ring: 'border-primary ring-primary/30 bg-primary/10',
      text: 'text-primary'
    }
  };

  function onPick(k: TextureKey) {
    value = k;
    pristine = false;
  }
  function onClear() {
    value = null;
    pristine = false;
  }
</script>

<fieldset class="grid grid-cols-3 gap-2 sm:grid-cols-6">
  <legend class="sr-only">Texture</legend>
  {#each TEXTURE_VALUES as k (k)}
    {@const active = value === k}
    {@const s = TILE[k]}
    <label
      class={cn(
        'group relative flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-all duration-200 ease-soft',
        'has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
        s.tint,
        s.text,
        active
          ? cn(s.ring, 'border-2 ring-2 -translate-y-0.5 shadow-card motion-reduce:transform-none')
          : 'hover:opacity-90'
      )}
    >
      <input
        type="radio"
        {name}
        value={k}
        checked={active}
        onchange={() => onPick(k)}
        class="sr-only"
      />
      {#if active}
        <span
          class="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-current"
          aria-hidden="true"
        >
          <Check size={11} strokeWidth={3} class="text-background" />
        </span>
      {/if}
      <span class={cn('text-xs', active ? 'font-semibold' : 'font-medium')}>
        {getTextureLabel(k)}
      </span>
    </label>
  {/each}
</fieldset>

{#if pristine && ageMonths != null}
  <p class="mt-1 text-[11px] text-muted-foreground">
    par défaut pour {Math.floor(ageMonths)} mois — modifiable
  </p>
{/if}

<button
  type="button"
  onclick={onClear}
  disabled={value == null}
  class="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
  aria-label="Effacer la texture"
>
  <X size={11} />
  Effacer
</button>
```

- [ ] **Step 2: Smoke-build to catch typing errors**

Run: `npm run check`
Expected: no svelte-check errors related to `TexturePicker.svelte`. Fix any token-name mismatches against `tailwind.config.ts` — if a `tile-*-fg` token name differs, adjust accordingly (do **not** invent new tokens; use the closest existing match).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/TexturePicker.svelte
git commit -m "feat(texture): TexturePicker component (six tinted cards + clear)"
```

---

## Task 5: Wire `TexturePicker` into the log sheet

**Files:**

- Modify: `src/routes/child/[id]/log/+page.svelte`

- [ ] **Step 1: Add the import + state**

After `import ReactionPicker from '$lib/components/ReactionPicker.svelte';` add:

```ts
import TexturePicker from '$lib/components/TexturePicker.svelte';
import { defaultTextureForAgeMonths, type TextureKey } from '$lib/utils/textures';
```

After `let reaction = $state<'ras' | 'inconfort' | 'reaction'>('ras');` add:

```ts
let texture = $state<TextureKey | null>(
  defaultTextureForAgeMonths(ageInMonths(data.child.birthDate))
);
let texturePristine = $state(true);
```

- [ ] **Step 2: Render the picker block after `ReactionPicker`**

After the existing `<div class="grid gap-1.5"> … <ReactionPicker /> … </div>` block, add:

```svelte
<div class="grid gap-1.5">
  <Label>Texture (facultatif)</Label>
  <TexturePicker
    name="texture"
    bind:value={texture}
    bind:pristine={texturePristine}
    ageMonths={ageInMonths(data.child.birthDate)}
  />
</div>
```

- [ ] **Step 3: Manual smoke**

Run: `npm run dev` and visit `/child/<id>/log`. Confirm the texture picker renders below the reaction picker, the default chip matches the child's age, and `Effacer` clears the selection. Check that submitting the form with the default unchanged still POSTs `texture=<default>` (network tab). Press <kbd>Ctrl+C</kbd> when done.

- [ ] **Step 4: Run the type / unit suite to catch regressions**

Run: `npm run check && npm test`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/routes/child/[id]/log/+page.svelte
git commit -m "feat(texture): wire TexturePicker into the log sheet with age-based default"
```

---

## Task 6: Feed badge + entry detail row

**Files:**

- Modify: `src/routes/child/[id]/foods/+page.server.ts` — include `texture` in feed select
- Modify: `src/routes/child/[id]/foods/+page.svelte` — render texture chip on each row
- Modify: `src/routes/child/[id]/foods/[entryId]/+page.server.ts` — include `texture` in `loadEntryForChild()`
- Modify: `src/routes/child/[id]/foods/[entryId]/+page.svelte` — render texture row in header

- [ ] **Step 1: Write the failing entry-detail test**

In `src/routes/child/[id]/foods/[entryId]/page.server.test.ts`, add:

```ts
it('returns texture in the entry payload when set', async () => {
  const ctx = await setup();
  await ctx.testDb.insert(foodEntries).values({
    childId: ctx.childId,
    foodId: ctx.foodId,
    givenAt: new Date(),
    reaction: 'ras',
    texture: 'ecrasee',
    notes: null,
    createdAt: new Date()
  });
  const [row] = await ctx.testDb
    .select()
    .from(foodEntries)
    .where(eq(foodEntries.childId, ctx.childId));
  const event = makeRouteEvent({
    params: { id: String(ctx.childId), entryId: String(row.id) },
    locals: ctx.locals
  });
  const data = await load(event);
  expect(data.entry.texture).toBe('ecrasee');
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run src/routes/child/[id]/foods/[entryId]/page.server.test.ts`
Expected: FAIL — `entry.texture` is `undefined`.

- [ ] **Step 3: Extend the loader to include `texture`**

In `src/routes/child/[id]/foods/[entryId]/+page.server.ts`, find the Drizzle `select` that builds the entry payload and add `texture: foodEntries.texture` to the projection. Also add `texture: TextureKey | null` to the exported `EntryDetail` type if such a type exists.

- [ ] **Step 4: Run, verify it passes**

Run: same as Step 2. Expected PASS.

- [ ] **Step 5: Render texture in the entry detail header**

In `src/routes/child/[id]/foods/[entryId]/+page.svelte`, near where reaction is displayed, add:

```svelte
{#if data.entry.texture}
  <div class="flex items-center gap-2 text-sm">
    <span class="text-muted-foreground">Texture</span>
    <span class="font-medium">{getTextureLabel(data.entry.texture)}</span>
  </div>
{/if}
```

with `import { getTextureLabel } from '$lib/utils/textures';` at the top.

- [ ] **Step 6: Extend the feed loader**

In `src/routes/child/[id]/foods/+page.server.ts`, locate the Drizzle select that pulls feed rows (it joins `food_entries` with `foods`). Add `texture: foodEntries.texture` to the projection and to the exported `FeedRow`/equivalent type.

- [ ] **Step 7: Render a texture tag on each feed row**

In `src/routes/child/[id]/foods/+page.svelte`, find the meta row that already renders date / reaction. Right after the food name (or as a sibling of the existing meta line), conditionally add:

```svelte
{#if row.texture}
  <span class="text-[11px] uppercase tracking-wide text-muted-foreground">
    · {getTextureLabel(row.texture)}
  </span>
{/if}
```

with the `getTextureLabel` import at the top.

- [ ] **Step 8: Smoke**

Run: `npm run check && npm test`
Expected: green.

- [ ] **Step 9: Commit**

```bash
git add src/routes/child/[id]/foods/+page.server.ts \
        src/routes/child/[id]/foods/+page.svelte \
        src/routes/child/[id]/foods/[entryId]/+page.server.ts \
        src/routes/child/[id]/foods/[entryId]/+page.svelte \
        src/routes/child/[id]/foods/[entryId]/page.server.test.ts
git commit -m "feat(texture): show texture on feed rows and entry detail header"
```

---

## Task 7: Edit flow

**Files:**

- Modify: `src/routes/child/[id]/foods/[entryId]/edit/+page.server.ts` (and `+page.svelte`) — accept texture in the update form (verify exact path during step 1; this is the entry-edit route)

- [ ] **Step 1: Confirm the edit route path**

Run: `find src/routes/child -type d -name edit`
Expected: a directory under `[entryId]/edit` (or named `edit/`). Note the exact path.

- [ ] **Step 2: Extend the Zod schema and update statement**

In the edit `+page.server.ts`:

- Add `import { TEXTURE_VALUES } from '$lib/utils/textures';`.
- Add `texture: z.enum(TEXTURE_VALUES).optional()` to the form schema (alongside the other optional fields). Also accept the literal string `''` to mean "clear to null" — use `z.union([z.enum(TEXTURE_VALUES), z.literal('')]).optional()` and normalize `'' → null` after parse.
- In the `db.update(foodEntries).set({...})` call, add: `texture: parsed.data.texture === '' ? null : parsed.data.texture ?? existing.texture`.

(_existing.texture_ preserves the value when the field is omitted from the form, not when it's submitted-but-empty. Tune to match the edit page's submit semantics — verify by reading the existing PATCH/POST shape before changing.)

- [ ] **Step 3: Wire `TexturePicker` into the edit page**

In the edit `+page.svelte`, mirror Task 5 — import, state initialized to the current entry's `texture`, render below `ReactionPicker`. Set `pristine = false` initially (the caption is only useful on first creation).

- [ ] **Step 4: Add a regression test**

Append to the edit route's `page.server.test.ts`:

```ts
it('updates texture on edit submit', async () => {
  const ctx = await setupWithEntry({ texture: 'lisse' });
  const form = new FormData();
  // …other existing fields…
  form.set('texture', 'ecrasee');
  const event = makeFormEvent({ form, params: ctx.params, locals: ctx.locals });
  await actions.default(event);
  const [row] = await ctx.testDb.select().from(foodEntries).where(eq(foodEntries.id, ctx.entryId));
  expect(row.texture).toBe('ecrasee');
});

it('clears texture when form submits empty string', async () => {
  const ctx = await setupWithEntry({ texture: 'lisse' });
  const form = new FormData();
  form.set('texture', '');
  const event = makeFormEvent({ form, params: ctx.params, locals: ctx.locals });
  await actions.default(event);
  const [row] = await ctx.testDb.select().from(foodEntries).where(eq(foodEntries.id, ctx.entryId));
  expect(row.texture).toBeNull();
});
```

- [ ] **Step 5: Run + commit**

```bash
npm run check && npm test
git add src/routes/child/[id]/foods/[entryId]/edit/
git commit -m "feat(texture): allow editing texture on existing entries"
```

---

## Task 8: _« Textures explorées »_ tile in CarnetStats

**Files:**

- Modify: `src/lib/components/bento/CarnetStats.svelte` (find its data source — usually a `loadDiversityMetrics()` or similar in `src/routes/child/[id]/foods/+page.server.ts`)
- Modify: that loader to include `texturesTried: number`

- [ ] **Step 1: Locate the diversity-metrics loader**

Run: `grep -rn 'loadDiversityMetrics\|CarnetStats' src/lib src/routes`
Expected: a function used by both the `/foods` page server and the bento tile. Note the file.

- [ ] **Step 2: Add a query for distinct non-null textures**

In that loader, add:

```ts
const texturesTried =
  (
    await db
      .select({ n: sql<number>`count(distinct ${foodEntries.texture})::int` })
      .from(foodEntries)
      .where(and(eq(foodEntries.childId, childId), sql`${foodEntries.texture} IS NOT NULL`))
      .limit(1)
  )[0]?.n ?? 0;
```

Add `texturesTried` to the returned object and its TypeScript type.

- [ ] **Step 3: Write a failing test for the new field**

Append to the loader's test file:

```ts
it('counts distinct non-null textures across entries', async () => {
  const ctx = await setup();
  await ctx.testDb.insert(foodEntries).values([
    {
      childId: ctx.childId,
      foodId: ctx.foodId,
      givenAt: new Date(),
      reaction: 'ras',
      texture: 'lisse',
      createdAt: new Date()
    },
    {
      childId: ctx.childId,
      foodId: ctx.foodId,
      givenAt: new Date(),
      reaction: 'ras',
      texture: 'lisse',
      createdAt: new Date()
    },
    {
      childId: ctx.childId,
      foodId: ctx.foodId,
      givenAt: new Date(),
      reaction: 'ras',
      texture: 'ecrasee',
      createdAt: new Date()
    },
    {
      childId: ctx.childId,
      foodId: ctx.foodId,
      givenAt: new Date(),
      reaction: 'ras',
      texture: null,
      createdAt: new Date()
    }
  ]);
  const result = await loadDiversityMetrics(ctx.childId);
  expect(result.texturesTried).toBe(2);
});
```

- [ ] **Step 4: Run + confirm passes**

Run: `npx vitest run <loader-test-path>`
Expected: PASS.

- [ ] **Step 5: Render the tile**

In `src/lib/components/bento/CarnetStats.svelte`, find the existing tile that renders "Foods tried" or similar (the pattern of `{tried}/{total}` body, mint tint). Duplicate that block, point it at `metrics.texturesTried`, hard-code the denominator `6`, and label it _« Textures explorées »_. Use the same `tile-mint-*` tokens.

```svelte
<div class="rounded-lg border bg-tile-mint-200/60 p-3 text-tile-mint-fg">
  <p class="text-[11px] font-semibold uppercase tracking-wide opacity-70">Textures explorées</p>
  <p class="mt-1 text-2xl font-extrabold tabular-nums">{metrics.texturesTried} / 6</p>
</div>
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/bento/CarnetStats.svelte <loader-path> <loader-test-path>
git commit -m "feat(texture): textures explorées tile in CarnetStats"
```

---

## Task 9: i18n keys for texture surfaces + e2e smoke

**Files:**

- Modify: `messages/fr.json`, `messages/en.json`
- Modify: a representative E2E spec (find with `find e2e -name '*.spec.ts' | xargs grep -l 'log'`); extend it

- [ ] **Step 1: Add i18n keys**

In `messages/fr.json` (paraglide):

```jsonc
{
  // …existing…
  "textureLabel": "Texture",
  "textureOptional": "Texture (facultatif)",
  "textureDefaultHint": "par défaut pour {ageMonths} mois — modifiable",
  "textureClear": "Effacer",
  "textureLisse": "Lisse",
  "textureMoulinee": "Moulinée",
  "textureEcrasee": "Écrasée",
  "texturePetitsMorceaux": "Petits morceaux",
  "textureMorceaux": "Morceaux",
  "textureFinger": "Finger food",
  "textureStatTitle": "Textures explorées",
  "textureStatBody": "{tried} / 6"
}
```

Mirror to `messages/en.json` with EN labels (`Smooth purée`, `Blended`, `Mashed`, `Small soft pieces`, `Pieces`, `Finger food`).

Refactor the hard-coded FR strings in `TexturePicker.svelte`, the log page, and `CarnetStats.svelte` to use `m.textureXxx()` — match the pattern in `src/routes/child/[id]/log/+page.svelte:19`.

Update `src/lib/utils/textures.ts::getTextureLabel` to call the paraglide function instead of a static record. Update the existing test in Task 1 (Step 1) accordingly — labels will now come from the paraglide runtime, so test by mocking the message module or by checking against the static map kept in the i18n source.

- [ ] **Step 2: Run all unit + check**

Run: `npm run check && npm test`
Expected: green; if `getTextureLabel` test breaks because labels are now dynamic, rewrite that assertion to test the keys (TEXTURE_VALUES) rather than the labels, and add a small smoke that verifies a label appears in the rendered log page via `@testing-library/svelte`.

- [ ] **Step 3: Extend an E2E happy-path**

In the e2e spec that covers logging a food (e.g. `e2e/log.spec.ts`), append assertions:

```ts
test('texture defaults to age-appropriate and surfaces on the feed', async ({ page }) => {
  // …existing log-a-food sign-up + navigation…
  await page.goto(`/child/${childId}/log`);
  // The picker pre-selects something (we don't care which key for this smoke).
  await expect(page.getByRole('group', { name: 'Texture' })).toBeVisible();
  // Submit without touching texture.
  await page.getByLabel('Aliment').fill('Poire');
  await page.getByRole('button', { name: /noter ce repas/i }).click();
  // Land on the feed; the new row shows a texture chip.
  await page.waitForURL(/\/child\/.+/);
  await page.goto(`/child/${childId}/foods`);
  await expect(page.getByText(/Lisse|Moulinée|Écrasée|Petits morceaux|Morceaux/)).toBeVisible();
});
```

(Adapt fixtures to match the local helpers in `e2e/_helpers.ts`. Don't reinvent signUp — use `signUpAndCreateChild` per the helpers consolidation in PR #119.)

- [ ] **Step 4: Run E2E locally**

Run: `npm run test:e2e -- --grep texture`
Expected: PASS. If the FAB → `/log` shortcut differs from the assumed URL, follow the actual flow used by the existing e2e spec.

- [ ] **Step 5: Commit**

```bash
git add messages/ src/lib/components/TexturePicker.svelte \
        src/routes/child/[id]/log/+page.svelte \
        src/lib/components/bento/CarnetStats.svelte \
        src/lib/utils/textures.ts \
        src/lib/utils/textures.test.ts \
        e2e/
git commit -m "feat(texture): paraglide i18n keys + e2e smoke"
```

---

## Task 10: Run the full quality bar before opening PR 1

- [ ] **Step 1: Refresh graphify**

Run: `graphify update .`
Expected: AST-only update, no API cost.

- [ ] **Step 2: Full type-check + unit + e2e**

Run: `npm run check && npm test && npm run test:e2e`
Expected: all green.

- [ ] **Step 3: Open PR 1**

```bash
git push -u origin <branch>
gh pr create --title "feat(texture): texture progression on food entries" --body "$(cat <<'EOF'
## Summary
- Adds nullable `texture` enum on `food_entries` (six FR-primary values).
- `TexturePicker` mirrors `ReactionPicker`, pre-selected from the child's age.
- Renders on the feed row, entry detail, and edit page.
- New `Textures explorées` tile in CarnetStats.
- Migration `0005_food_entry_texture.sql` with CHECK constraint.

Spec: `docs/superpowers/specs/2026-05-15-texture-and-pediatrician-handoff-design.md`.

## Test plan
- [ ] Migration applies on a fresh DB.
- [ ] `npm test`
- [ ] `npm run test:e2e -- --grep texture`
- [ ] Manual: log a food on /child/[id]/log, verify default + clear + persisted value.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then run `scripts/pr-watch.sh` in the background (per the user's PR-watcher memory) and monitor for CI + Codex + /code-review feedback before merging.

---

# PR 2 — Bilan pour le pédiatre

**Branch:** create a new branch off `main` once PR 1 is merged (the texture column is a prerequisite).

## Task 11: Priority-first allergen ordering + isPriority flag in the report loader

**Files:**

- Modify: `src/routes/child/[id]/report/+page.server.ts:137–159`
- Modify: `src/routes/child/[id]/report/page.server.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/routes/child/[id]/report/page.server.test.ts`, add:

```ts
import { PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';

it('returns priority allergens first, then non-priority, both alphabetical by label within group', async () => {
  const ctx = await setup();
  const event = makeRouteEvent({ params: { id: String(ctx.childId) }, locals: ctx.locals });
  const data = await load(event);
  const priorityIds = new Set(PRIORITY_INTRODUCTION_ALLERGENS);
  const firstNonPriority = data.allergens.findIndex((a) => !priorityIds.has(a.id));
  // every priority allergen sits before any non-priority
  for (let i = 0; i < firstNonPriority; i++) {
    expect(priorityIds.has(data.allergens[i].id)).toBe(true);
  }
  for (let i = firstNonPriority; i < data.allergens.length; i++) {
    expect(priorityIds.has(data.allergens[i].id)).toBe(false);
  }
});

it('flags isPriority on each allergen row', async () => {
  const ctx = await setup();
  const event = makeRouteEvent({ params: { id: String(ctx.childId) }, locals: ctx.locals });
  const data = await load(event);
  for (const row of data.allergens) {
    expect(row.isPriority).toBe(PRIORITY_INTRODUCTION_ALLERGENS.includes(row.id));
  }
});
```

- [ ] **Step 2: Run, verify fails**

Run: `npx vitest run src/routes/child/[id]/report/page.server.test.ts`
Expected: FAIL — `isPriority` missing, ordering arbitrary.

- [ ] **Step 3: Update the loader**

In `src/routes/child/[id]/report/+page.server.ts`:

Add to the `AllergenReportRow` type (L31–39):

```ts
isPriority: boolean;
```

Add to the `ALLERGENS.map((a) => …)` block (L137–159):

```ts
import { PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';
// …

const allergens: AllergenReportRow[] = ALLERGENS.map((a) => {
  const isPriority = PRIORITY_INTRODUCTION_ALLERGENS.includes(a.id);
  const agg = allergenAggMap.get(a.id);
  if (!agg) {
    return {
      id: a.id,
      label: a.label,
      isPriority,
      status: 'untested' as const,
      worst: null,
      exposures: 0,
      firstGivenAt: null,
      lastGivenAt: null
    };
  }
  return {
    id: a.id,
    label: a.label,
    isPriority,
    status: 'introduced' as const,
    worst: agg.worst,
    exposures: agg.exposures,
    firstGivenAt: agg.first,
    lastGivenAt: agg.last
  };
}).sort((x, y) => {
  if (x.isPriority !== y.isPriority) return x.isPriority ? -1 : 1;
  return x.label.localeCompare(y.label, 'fr');
});
```

- [ ] **Step 4: Run, verify passes**

Same vitest invocation. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/child/[id]/report/+page.server.ts src/routes/child/[id]/report/page.server.test.ts
git commit -m "feat(report): order allergens priority-first, flag isPriority"
```

---

## Task 12: Stage status block (current stage + texture gap)

**Files:**

- Modify: `src/routes/child/[id]/report/+page.server.ts` — add `stage`, `mostAdvancedTexture`
- Modify: `src/routes/child/[id]/report/+page.svelte` — render section
- Modify: `src/routes/child/[id]/report/page.server.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { TEXTURE_VALUES } from '$lib/utils/textures';

it('returns the current diversification stage + most-advanced logged texture', async () => {
  const ctx = await setup({ ageMonths: 10 });
  await ctx.testDb.insert(foodEntries).values([
    {
      childId: ctx.childId,
      foodId: ctx.foodId,
      givenAt: new Date(),
      reaction: 'ras',
      texture: 'lisse',
      createdAt: new Date()
    },
    {
      childId: ctx.childId,
      foodId: ctx.foodId,
      givenAt: new Date(),
      reaction: 'ras',
      texture: 'ecrasee',
      createdAt: new Date()
    }
  ]);
  const event = makeRouteEvent({ params: { id: String(ctx.childId) }, locals: ctx.locals });
  const data = await load(event);
  expect(data.stage.id).toBe('9-12');
  expect(data.mostAdvancedTexture).toBe('ecrasee');
});

it('returns null mostAdvancedTexture when no texture has been logged', async () => {
  const ctx = await setup({ ageMonths: 7 });
  const event = makeRouteEvent({ params: { id: String(ctx.childId) }, locals: ctx.locals });
  const data = await load(event);
  expect(data.mostAdvancedTexture).toBeNull();
});
```

- [ ] **Step 2: Run, verify fails**

Expected: FAIL — `data.stage` and `data.mostAdvancedTexture` undefined.

- [ ] **Step 3: Update the loader**

Add to `src/routes/child/[id]/report/+page.server.ts`:

```ts
import { ageInMonths } from '$lib/utils/age';
import { getStageForAgeMonths, type Stage } from '$lib/content/guidance';
import { TEXTURE_VALUES, type TextureKey, isTextureKey } from '$lib/utils/textures';
```

After computing `entries` (around L72), compute the most-advanced texture by scanning `entries` and picking the largest `TEXTURE_VALUES` index (treating `finger` as parallel — see note below):

```ts
let mostAdvancedIdx = -1;
for (const e of rows) {
  // e is the raw row; check the texture from the raw select if not yet on ReportEntry.
  // After Task 6 you already added texture to the select; pipe it through to entries.
  if (!isTextureKey(e.texture)) continue;
  if (e.texture === 'finger') continue; // parallel: don't count toward "most advanced"
  const idx = TEXTURE_VALUES.indexOf(e.texture);
  if (idx > mostAdvancedIdx) mostAdvancedIdx = idx;
}
const mostAdvancedTexture: TextureKey | null =
  mostAdvancedIdx >= 0 ? TEXTURE_VALUES[mostAdvancedIdx] : null;

const stage: Stage = getStageForAgeMonths(ageInMonths(child.birthDate));
```

Add `stage` and `mostAdvancedTexture` to the returned object (and to its type if exported).

**Pre-req for this task:** the `rows` select on L46–60 must include `foodEntries.texture` — Task 6 already added this for the feed, but the report loader is a separate select. Add it here:

```ts
.select({
  // …existing…
  texture: foodEntries.texture
})
```

And add `texture` to the `ReportEntry` type (L9–18).

- [ ] **Step 4: Run, verify passes**

Same vitest invocation. Expected: PASS.

- [ ] **Step 5: Render the section in `+page.svelte`**

Add a new section between the totals header and the category groups:

```svelte
<section class="space-y-2 rounded-lg border bg-card p-4">
  <h2 class="text-lg font-semibold">Étape de diversification</h2>
  <p class="text-sm text-muted-foreground">{data.stage.title}</p>
  <p class="text-sm">{data.stage.oneLiner}</p>
  <p class="text-sm">
    <span class="text-muted-foreground">Textures attendues : </span>{data.stage.textures}
  </p>
  {#if data.mostAdvancedTexture}
    <p class="text-sm">
      <span class="text-muted-foreground">Texture la plus avancée enregistrée : </span>
      {getTextureLabel(data.mostAdvancedTexture)}
    </p>
  {/if}
</section>
```

Add `import { getTextureLabel } from '$lib/utils/textures';` at the top.

- [ ] **Step 6: Commit**

```bash
git add src/routes/child/[id]/report/+page.server.ts \
        src/routes/child/[id]/report/+page.svelte \
        src/routes/child/[id]/report/page.server.test.ts
git commit -m "feat(report): stage status + most-advanced texture row"
```

---

## Task 13: Textures distribution mini-bar (last 30 days)

**Files:**

- Modify: `src/routes/child/[id]/report/+page.server.ts`
- Modify: `src/routes/child/[id]/report/+page.svelte`
- Modify: `src/routes/child/[id]/report/page.server.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('returns a texture distribution over the last 30 days (counts per key + total)', async () => {
  const ctx = await setup();
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  await ctx.testDb.insert(foodEntries).values([
    // within window
    {
      childId: ctx.childId,
      foodId: ctx.foodId,
      givenAt: new Date(now - 1 * day),
      reaction: 'ras',
      texture: 'lisse',
      createdAt: new Date()
    },
    {
      childId: ctx.childId,
      foodId: ctx.foodId,
      givenAt: new Date(now - 2 * day),
      reaction: 'ras',
      texture: 'lisse',
      createdAt: new Date()
    },
    {
      childId: ctx.childId,
      foodId: ctx.foodId,
      givenAt: new Date(now - 3 * day),
      reaction: 'ras',
      texture: 'ecrasee',
      createdAt: new Date()
    },
    {
      childId: ctx.childId,
      foodId: ctx.foodId,
      givenAt: new Date(now - 4 * day),
      reaction: 'ras',
      texture: null,
      createdAt: new Date()
    },
    // outside window
    {
      childId: ctx.childId,
      foodId: ctx.foodId,
      givenAt: new Date(now - 60 * day),
      reaction: 'ras',
      texture: 'morceaux',
      createdAt: new Date()
    }
  ]);
  const event = makeRouteEvent({ params: { id: String(ctx.childId) }, locals: ctx.locals });
  const data = await load(event);
  expect(data.textureDistribution.totalWithTexture).toBe(3);
  expect(data.textureDistribution.counts.lisse).toBe(2);
  expect(data.textureDistribution.counts.ecrasee).toBe(1);
  expect(data.textureDistribution.counts.morceaux).toBe(0);
});
```

- [ ] **Step 2: Run, verify fails**

Expected: FAIL.

- [ ] **Step 3: Compute the distribution**

In the loader, after `mostAdvancedTexture`, add:

```ts
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const cutoff = Date.now() - THIRTY_DAYS_MS;

const counts: Record<TextureKey, number> = {
  lisse: 0,
  moulinee: 0,
  ecrasee: 0,
  'petits-morceaux': 0,
  morceaux: 0,
  finger: 0
};
let totalWithTexture = 0;
for (const e of entries) {
  if (e.givenAt < cutoff) continue;
  if (!isTextureKey(e.texture)) continue;
  counts[e.texture] += 1;
  totalWithTexture += 1;
}

const textureDistribution = { counts, totalWithTexture };
```

Add `textureDistribution` to the returned object.

(Reuses the `entries` array — no extra query.)

- [ ] **Step 4: Run, verify passes**

Same invocation. Expected: PASS.

- [ ] **Step 5: Render the mini-bar**

In `+page.svelte`, after the stage section:

```svelte
<section class="space-y-2 rounded-lg border bg-card p-4">
  <h2 class="text-lg font-semibold">Textures sur 30 jours</h2>
  {#if data.textureDistribution.totalWithTexture === 0}
    <p class="text-sm text-muted-foreground">Aucune texture enregistrée sur la période.</p>
  {:else}
    <ul class="space-y-1.5">
      {#each TEXTURE_VALUES as k (k)}
        {@const n = data.textureDistribution.counts[k]}
        {@const pct = Math.round((n / data.textureDistribution.totalWithTexture) * 100)}
        <li class="grid grid-cols-[10ch_1fr_3ch] items-center gap-2 text-sm">
          <span class="text-muted-foreground">{getTextureLabel(k)}</span>
          <span class="h-2 rounded-full bg-muted">
            <span class="block h-2 rounded-full bg-foreground/70" style="width: {pct}%"></span>
          </span>
          <span class="text-right tabular-nums">{n}</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>
```

with `import { TEXTURE_VALUES } from '$lib/utils/textures';` at the top.

- [ ] **Step 6: Commit**

```bash
git add src/routes/child/[id]/report/+page.server.ts \
        src/routes/child/[id]/report/+page.svelte \
        src/routes/child/[id]/report/page.server.test.ts
git commit -m "feat(report): 30-day texture distribution bar"
```

---

## Task 14: Print stylesheet + _« Imprimer »_ button + nav rename

**Files:**

- Modify: `src/routes/child/[id]/report/+page.svelte`
- Modify: nav source — find with `grep -rn 'report\|Bilan' src/lib/components src/routes/child/[id]/+layout.svelte`

- [ ] **Step 1: Add the print button**

Near the top of `+page.svelte`, above the totals, add:

```svelte
<div class="flex items-center justify-between print:hidden">
  <h1 class="text-2xl font-semibold">Bilan pour le pédiatre</h1>
  <button
    type="button"
    onclick={() => window.print()}
    class="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
  >
    Imprimer
  </button>
</div>
```

- [ ] **Step 2: Add the print stylesheet block**

At the end of `+page.svelte`:

```svelte
<style>
  @media print {
    :global(html, body) {
      background: #fff !important;
      color: #000 !important;
      font-size: 11pt;
    }
    /* Hide app chrome */
    :global(header[data-app-shell], nav[data-app-shell], [data-fab], [data-bottom-nav]) {
      display: none !important;
    }
    section {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
</style>
```

(The `[data-app-shell]` / `[data-fab]` / `[data-bottom-nav]` attributes may not exist yet — verify in `src/lib/components/SharedTopBar.svelte` and the bottom-nav component. If they don't, add `data-app-shell` to the top bar and `data-fab` to the FAB during this task. Don't add CSS that doesn't match a real selector — verify with `grep -rn 'data-app-shell\|data-fab\|data-bottom-nav' src/lib/components` before committing the rule.)

- [ ] **Step 3: Add a printed footer**

Right before the closing `</div>` of the page:

```svelte
<footer class="mt-6 hidden text-center text-xs text-muted-foreground print:block">
  Imprimé le {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(data.generatedAt))}
  · Diversif
</footer>
```

- [ ] **Step 4: Rename the navigation link**

Run: `grep -rn 'href.*/report\|Bilan' src/lib/components src/routes/child/[id]/+layout.svelte`
Update the matching label string from its current value to `'Bilan pour le pédiatre'` (FR). Add a paraglide key `reportNavLabel` and EN translation `Pediatrician summary`.

- [ ] **Step 5: Manual print preview**

Run: `npm run dev` and open `/child/<id>/report`. Use the browser's print preview (Cmd/Ctrl-P). Confirm: no FAB, no top bar, single column, footer with date, all sections visible. Press <kbd>Ctrl+C</kbd> when done.

- [ ] **Step 6: Commit**

```bash
git add src/routes/child/[id]/report/+page.svelte messages/ \
        src/lib/components/SharedTopBar.svelte # if data-app-shell added
git commit -m "feat(report): print stylesheet, Imprimer button, nav rename"
```

---

## Task 15: WebKit print smoke + final quality bar

**Files:**

- Modify: `e2e/report.spec.ts` (or create)

- [ ] **Step 1: Write the smoke**

```ts
// e2e/report.spec.ts
import { test, expect } from '@playwright/test';
import { signUpAndCreateChild } from './_helpers';

test.describe('Bilan pour le pédiatre — print', () => {
  test('hides FAB and Imprimer button under print emulation', async ({ page, browserName }) => {
    test.skip(browserName === 'firefox', 'print-stylesheet smoke covered by Chromium + WebKit');
    const { childId } = await signUpAndCreateChild(page);
    await page.goto(`/child/${childId}/report`);
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('[data-fab]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Imprimer' })).toBeHidden();
    await expect(page.getByText('Bilan pour le pédiatre')).toBeVisible();
    await expect(page.getByText(/Imprimé le/)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run on Chromium + WebKit**

Run: `npm run test:e2e -- --project=chromium --project=webkit --grep print`
Expected: PASS in both. If WebKit fails on a specific selector, investigate — don't `--skip` it.

- [ ] **Step 3: Refresh graphify**

Run: `graphify update .`

- [ ] **Step 4: Full quality bar**

Run: `npm run check && npm test && npm run test:e2e`
Expected: green.

- [ ] **Step 5: Open PR 2**

```bash
git push -u origin <branch>
gh pr create --title "feat(report): Bilan pour le pédiatre — printable handoff" --body "$(cat <<'EOF'
## Summary
- Renames `/child/[id]/report` UX to *« Bilan pour le pédiatre »* (URL unchanged).
- Orders allergens priority-first with an `isPriority` flag.
- New stage status section with most-advanced texture row.
- 30-day texture distribution bar.
- Print stylesheet + `Imprimer` button — browser save-as-PDF, no server dependency.

Depends on the texture column from #N (the previous PR).

Spec: `docs/superpowers/specs/2026-05-15-texture-and-pediatrician-handoff-design.md`.

## Test plan
- [ ] `npm test`
- [ ] `npm run test:e2e -- --grep print`
- [ ] Manual: print preview on Chromium + Safari, confirm clean A4 output.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Start `scripts/pr-watch.sh` in the background and monitor CI + Codex + /code-review feedback per the standing instructions.

---

## Self-Review Notes

This plan was reviewed against the spec on 2026-05-15:

- **Spec coverage:** Every Feature-1 and Feature-2 sub-section maps to one or more tasks (Tasks 1–9 → texture; Tasks 11–15 → handoff). The "out-of-scope" §8 of the spec produces no tasks — by design.
- **Deviation from spec:** the spec proposed sourcing the allergen status from `loadBentoAllergens()`. Inspecting the existing `/child/[id]/report` loader, the per-allergen rollup (`AllergenReportRow`) already exposes `status`, `worst`, `exposures`, `firstGivenAt`, `lastGivenAt`. Adding `isPriority` and a sort produces the same outcome without a parallel data path — see Task 11. Recorded in the plan's Architecture section.
- **Type consistency:** `TextureKey`, `TEXTURE_VALUES`, `defaultTextureForAgeMonths`, `getTextureLabel`, `isTextureKey` are defined in Task 1 and referenced uniformly thereafter. `AllergenReportRow.isPriority` lands in Task 11 and is read in the template (Task 14 implicitly via render). `mostAdvancedTexture` is `TextureKey | null` everywhere.
- **No placeholders:** all "TBD" / "TODO" patterns absent; every code-changing step shows the code. The few "verify exact path" notes (e.g. Task 7 Step 1, Task 14 Step 1) are scoped one-line lookups, not implementation deferrals.
