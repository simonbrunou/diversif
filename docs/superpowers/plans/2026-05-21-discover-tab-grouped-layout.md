# Discover tab grouped layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the eight stacked sections of the Discover tab into three semantically-named, tinted groups (Repères / À essayer / Apprendre) via a new `DiscoverGroup` wrapper component.

**Architecture:** Pure presentational refactor. Introduce `src/lib/components/bento/DiscoverGroup.svelte` (label + tint wrapper, ~30 lines). Rewire `DiscoverBento.svelte` to wrap its existing 8 children in 3 `<DiscoverGroup>` instances. Add three CSS selectors keyed off `[data-tint]` in `src/app.css` that pull from existing `--tile-*` design tokens at low alpha. Three new i18n keys.

**Tech Stack:** SvelteKit · Svelte 5 (`$props`, `Snippet`, `{@render}`) · Tailwind via tokens · Paraglide for i18n · Vitest + Testing Library Svelte · pg-mem · 100% coverage threshold.

**Spec reference:** `docs/superpowers/specs/2026-05-21-discover-tab-grouped-layout-design.md`

---

## Task 0: Branch + paraglide baseline

**Files:** none yet

- [ ] **Step 1: Create feature branch off main**

```bash
git checkout main
git pull --ff-only
git checkout -b polish/discover-grouped-layout
```

- [ ] **Step 2: Confirm paraglide command works**

```bash
npm run paraglide
```

Expected: `Successfully compiled the project.` (No file changes — just establishing the toolchain works before we add keys.)

---

## Task 1: Add the three i18n keys

**Files:**

- Modify: `messages/fr.json` — add three keys
- Modify: `messages/en.json` — add three keys, in same alphabetic position
- Will trigger: `npm run paraglide` regenerates `src/paraglide/`

- [ ] **Step 1: Add keys to `messages/fr.json`**

Find an alphabetically-appropriate location (after `dialogs*` keys, before `errors*`). Insert:

```json
  "discoverGroupApprendre": "Apprendre",
  "discoverGroupAEssayer": "À essayer",
  "discoverGroupReperes": "Repères",
```

- [ ] **Step 2: Add the matching keys to `messages/en.json`**

Same location, English copy:

```json
  "discoverGroupApprendre": "Learn",
  "discoverGroupAEssayer": "Worth trying",
  "discoverGroupReperes": "Reference points",
```

- [ ] **Step 3: Regenerate paraglide**

Run: `npm run paraglide`
Expected: `Successfully compiled the project.` — and `src/paraglide/messages.js` now exports `discoverGroupApprendre`, `discoverGroupAEssayer`, `discoverGroupReperes`.

- [ ] **Step 4: Verify keys typecheck**

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 5: Commit**

```bash
git add messages/fr.json messages/en.json src/paraglide/
git commit -m "i18n(discover): add group labels (Repères / À essayer / Apprendre)"
```

---

## Task 2: Create the `DiscoverGroup` component (TDD)

**Files:**

- Create: `src/lib/components/bento/DiscoverGroup.svelte`
- Create: `src/lib/components/bento/DiscoverGroup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/DiscoverGroup.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import DiscoverGroup from './DiscoverGroup.svelte';
import DiscoverGroupHarness from './DiscoverGroup.test.svelte';

afterEach(() => cleanup());

describe('DiscoverGroup', () => {
  it('renders the visible label text', () => {
    render(DiscoverGroup, { props: { label: 'Repères', tint: 'mint' } });
    expect(screen.getByText('Repères')).toBeTruthy();
  });

  it('exposes the label as the section accessible name via aria-label', () => {
    render(DiscoverGroup, { props: { label: 'À essayer', tint: 'peach' } });
    const section = screen.getByRole('region', { name: 'À essayer' });
    expect(section).toBeTruthy();
  });

  it('marks the visible label as decorative (aria-hidden) to avoid duplicating the accessible name', () => {
    const { container } = render(DiscoverGroup, {
      props: { label: 'Apprendre', tint: 'butter' }
    });
    const visible = container.querySelector('.discover-group__label');
    expect(visible).toBeTruthy();
    expect(visible?.getAttribute('aria-hidden')).toBe('true');
  });

  it.each([['mint' as const], ['peach' as const], ['butter' as const]])(
    'applies data-tint="%s" to the section',
    (tint) => {
      const { container } = render(DiscoverGroup, { props: { label: 'X', tint } });
      expect(container.querySelector(`.discover-group[data-tint="${tint}"]`)).toBeTruthy();
    }
  );

  it('renders slotted children via the children snippet', () => {
    render(DiscoverGroupHarness, { props: { label: 'Repères', tint: 'mint' } });
    expect(screen.getByTestId('child-content')).toBeTruthy();
  });
});
```

The last test needs a harness component (Svelte 5 children snippets can't be inlined from a plain JS test without a `.svelte` harness). Create `src/lib/components/bento/DiscoverGroup.test.svelte`:

```svelte
<script lang="ts">
  import DiscoverGroup from './DiscoverGroup.svelte';
  let { label, tint }: { label: string; tint: 'mint' | 'peach' | 'butter' } = $props();
</script>

<DiscoverGroup {label} {tint}>
  <div data-testid="child-content">slotted</div>
</DiscoverGroup>
```

- [ ] **Step 2: Run test to verify it fails (component does not exist yet)**

Run: `npm test -- DiscoverGroup`
Expected: FAIL with `Cannot find module './DiscoverGroup.svelte'` or similar.

- [ ] **Step 3: Create the minimal component**

Create `src/lib/components/bento/DiscoverGroup.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  type Tint = 'mint' | 'peach' | 'butter';

  let {
    label,
    tint,
    children
  }: {
    label: string;
    tint: Tint;
    children: Snippet;
  } = $props();
</script>

<section class="discover-group" data-tint={tint} aria-label={label}>
  <p class="discover-group__label" aria-hidden="true">{label}</p>
  {@render children()}
</section>
```

- [ ] **Step 4: Run tests — all should pass**

Run: `npm test -- DiscoverGroup`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/bento/DiscoverGroup.svelte src/lib/components/bento/DiscoverGroup.test.ts src/lib/components/bento/DiscoverGroup.test.svelte
git commit -m "feat(discover): add DiscoverGroup wrapper (label + tint)"
```

---

## Task 3: Add CSS rules for `[data-tint]` and the label

**Files:**

- Modify: `src/app.css` — append a new rule block

- [ ] **Step 1: Append CSS rules to `src/app.css`**

Add at the end of the file (or near other component-specific rules — match local convention if any block-like structure exists; otherwise append at the bottom):

```css
.discover-group {
  border-radius: 1rem;
  padding: 0.75rem;
  margin-bottom: 1.5rem;
}

@media (min-width: 640px) {
  .discover-group {
    padding: 1rem;
  }
}

.discover-group__label {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 0.5rem 0.25rem;
}

.discover-group[data-tint='mint'] {
  background-color: hsl(var(--tile-mint) / 0.18);
}
.discover-group[data-tint='mint'] .discover-group__label {
  color: hsl(var(--tile-mint-foreground));
}

.discover-group[data-tint='peach'] {
  background-color: hsl(var(--tile-peach) / 0.18);
}
.discover-group[data-tint='peach'] .discover-group__label {
  color: hsl(var(--tile-peach-foreground));
}

.discover-group[data-tint='butter'] {
  background-color: hsl(var(--tile-butter) / 0.16);
}
.discover-group[data-tint='butter'] .discover-group__label {
  color: hsl(var(--tile-butter-foreground));
}
```

- [ ] **Step 2: Confirm `--tile-*` tokens still exist where expected**

Run: `grep -n "tile-mint\|tile-peach\|tile-butter" src/app.css | head -10`
Expected: shows the existing `--tile-mint`, `--tile-peach`, `--tile-butter`, and their `-foreground` siblings under `:root` and (likely) `.dark`.

- [ ] **Step 3: Commit**

```bash
git add src/app.css
git commit -m "style(discover): tinted group surfaces via data-tint selectors"
```

---

## Task 4: Wire `DiscoverGroup` into `DiscoverBento.svelte`

**Files:**

- Modify: `src/lib/components/bento/DiscoverBento.svelte` — replace the flat `<div class="flex flex-col">` body with three `<DiscoverGroup>` wrappers

The current body (after PR #177) is:

```svelte
<div class="flex flex-col">
  <StagesBentoGrid {stages} {activeStageId} onOpen={openStageBy} />
  <AllergenPassport {allergens} />
  <TextureTimeline {ageMonths} progress={textureProgress} />
  <SeasonalFoods foods={seasonalFoods} month={currentMonth} {childId} />
  <Recipes {recipes} />
  <SuggestionFeed {suggestions} onPick={onPickSuggestion} viewAllHref={viewAllSuggestionsHref} />
  <DidYouKnow cards={factCards} />
  <SourcesCluster />
</div>
```

- [ ] **Step 1: Add imports**

At the top of the `<script>` block in `src/lib/components/bento/DiscoverBento.svelte`, add:

```ts
import DiscoverGroup from './DiscoverGroup.svelte';
import * as m from '$lib/paraglide/messages.js';
```

If `m` is already imported under a different name in this file, reuse that alias instead. Verify with: `grep "paraglide/messages" src/lib/components/bento/DiscoverBento.svelte`.

- [ ] **Step 2: Replace the template body**

Replace the `<div class="flex flex-col">…</div>` block with:

```svelte
<div class="flex flex-col">
  <DiscoverGroup label={m.discoverGroupReperes()} tint="mint">
    <StagesBentoGrid {stages} {activeStageId} onOpen={openStageBy} />
    <AllergenPassport {allergens} />
    <TextureTimeline {ageMonths} progress={textureProgress} />
  </DiscoverGroup>

  <DiscoverGroup label={m.discoverGroupAEssayer()} tint="peach">
    <SeasonalFoods foods={seasonalFoods} month={currentMonth} {childId} />
    <Recipes {recipes} />
    <SuggestionFeed {suggestions} onPick={onPickSuggestion} viewAllHref={viewAllSuggestionsHref} />
  </DiscoverGroup>

  <DiscoverGroup label={m.discoverGroupApprendre()} tint="butter">
    <DidYouKnow cards={factCards} />
    <SourcesCluster />
  </DiscoverGroup>
</div>
```

The `{#if openStage}` block at the bottom (StageDetailSheet) stays unchanged.

- [ ] **Step 3: Run existing DiscoverBento tests**

Run: `npm test -- DiscoverBento`
Expected: all existing tests still pass. The assertions on `'Les étapes'`, `'Suggestions du jour'`, and `'Sources scientifiques'` should keep working because each section's own `SectionHeader` is preserved.

- [ ] **Step 4: Add an assertion for one of the new group labels**

Append a test to `src/lib/components/bento/DiscoverBento.test.ts`. Inside the existing `describe('DiscoverBento', () => { … })` block, add:

```ts
it('renders the three group labels (Repères / À essayer / Apprendre)', () => {
  render(DiscoverBento, { props: baseProps });
  expect(screen.getByText('Repères')).toBeTruthy();
  expect(screen.getByText('À essayer')).toBeTruthy();
  expect(screen.getByText('Apprendre')).toBeTruthy();
});
```

- [ ] **Step 5: Run tests again**

Run: `npm test -- DiscoverBento`
Expected: all green, including the new group-labels test.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/bento/DiscoverBento.svelte src/lib/components/bento/DiscoverBento.test.ts
git commit -m "feat(discover): group the 8 sections into Repères / À essayer / Apprendre"
```

---

## Task 5: Coverage + typecheck + visual sanity

**Files:** none modified

- [ ] **Step 1: Run the full coverage suite**

Run: `npm run test:coverage`
Expected: `All files | 100 | 100 | 100 | 100`.
If anything drops, the most likely cause is the new test harness (`DiscoverGroup.test.svelte`) being counted as a source file. If so, exclude it via the pattern already used for other `*.test.svelte` harnesses if any (`grep -rn "test.svelte" vitest.config.ts package.json 2>/dev/null`).

- [ ] **Step 2: Typecheck**

Run: `npm run check`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Visual sanity at mobile width**

Start the dev server (`npm run dev`) and open the guide route in the browser at 375 px viewport width. Verify:

1. Three tinted bands stack top-to-bottom: mint, peach, butter
2. Each band shows its label at top-left in matching foreground colour
3. Inner section cards (suggestion tiles, allergen tiles, etc.) still read as the primary surface — the tint is the room, the cards are the furniture
4. No horizontal overflow
5. Total scroll length is not dramatically worse than before (anecdotal — eyeball it)

If the tint feels too strong/weak, adjust the alpha in `src/app.css` (the spec specified 0.18/0.18/0.16 — those are starting values).

- [ ] **Step 4: Refresh graphify**

Run: `graphify update .`
Expected: `Code graph updated.`

- [ ] **Step 5: Commit graph refresh**

```bash
git add graphify-out/GRAPH_REPORT.md graphify-out/graph.json graphify-out/graph.html graphify-out/manifest.json
git commit -m "chore(graphify): refresh after DiscoverGroup introduction"
```

---

## Task 6: Push + open PR

**Files:** none

- [ ] **Step 1: Push branch**

```bash
git push -u origin polish/discover-grouped-layout
```

- [ ] **Step 2: Open PR**

Use `gh pr create --base main` with body:

```markdown
## Summary

Split the Discover tab's eight stacked sections into three tinted groups (Repères / À essayer / Apprendre) so the screen stops reading as one undifferentiated scroll. New `DiscoverGroup` wrapper handles label + tinted surface via existing `--tile-*` design tokens at low alpha.

Brainstorm spec: `docs/superpowers/specs/2026-05-21-discover-tab-grouped-layout-design.md`

## Test plan

- [x] `npm test` + `npm run test:coverage` — green, 100% coverage held
- [x] `npm run check` — 0 errors
- [ ] Visual check at 375 px: three tinted bands, no overflow, inner cards still primary surface
- [ ] Light + dark mode both legible
```

- [ ] **Step 3: Note for the session driver**

The user's standing rules in this repo (carry-over from prior sessions): after the push, expect to run `/code-review`, request `@codex review`, wait for Codex 👍, then merge. The session driver will handle those manual steps.

---

## Self-Review Notes

Spec coverage walked end-to-end:

| Spec section                                                    | Plan task                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------- |
| Layout structure (3 groups, 8 inner sections in specific order) | Task 4 (wire-up)                                            |
| Visual treatment (rounded, padding, mb-6, tint alphas, label)   | Task 3 (CSS) + Task 2 (component)                           |
| Heading hierarchy (decorative `<p>` + `aria-label` on section)  | Task 2 step 3 (component code) + test step 1 (asserts both) |
| Dark mode (tokens are dark-aware)                               | Task 3 step 2 (token presence check)                        |
| Spacing rhythm                                                  | Task 3 step 1 (CSS values)                                  |
| `DiscoverGroup.svelte` API                                      | Task 2                                                      |
| i18n keys                                                       | Task 1                                                      |
| What does NOT change                                            | Implicit — no other files touched                           |
| Out of scope (hero, sub-tabs, bento grid)                       | Implicit — no tasks added for them                          |
| Tests for DiscoverGroup                                         | Task 2                                                      |
| Coverage threshold                                              | Task 5 step 1                                               |
| Visual heaviness on mobile                                      | Task 5 step 3                                               |
| Tailwind arbitrary values risk                                  | Mitigated in Task 3 (CSS-based, not Tailwind arbitrary)     |

No placeholders. No "TBD". Every step has the exact file, exact content, exact command, expected output.
