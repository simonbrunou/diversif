# Bundle 2 — Visual coherence sweep (Implementation Plan)

> **For agentic workers:** Steps use `- [ ]` checkboxes. Each task ends with a commit. The bundle ends with a PR stacked on Bundle 1 (`feat/simplify/bundle-1-foundation-primitives`).

**Spec:** `docs/superpowers/specs/2026-05-21-simplify-codebase-design.md`

**Goal:** Migrate consumers onto Bundle 1's primitives and fix the visual outliers the audit found, so the app reaches the design tokens it already declares.

**Architecture:** All work is in-place migration. No new components. Each task is a coherent sweep across one pattern (callouts, pill CTAs, section labels, outros) plus a small visual-fix batch. After each migration the existing unit + Playwright tests must stay green; no visible behavior change is intentional (only style/markup cleanup).

**Tech Stack:** SvelteKit, Tailwind, paraglide, vitest + Playwright.

**Conventions:**

- Branch: `feat/simplify/bundle-2-visual-coherence-sweep`, stacked on `feat/simplify/bundle-1-foundation-primitives` (PR #181).
- Do NOT run `npm run lint` — pre-existing warnings in `src/paraglide/` + `.playwright-mcp/`. Use `npx prettier --check <files>` per task.
- Test command: `npm test -- --run`.
- Conventional Commits.
- Pre-commit hooks must not be bypassed.

---

## Task 1: Amber-callout migration

**Files modified:**

- `src/routes/cgu/+page.svelte`
- `src/routes/allergens/+page.svelte`
- `src/routes/+page.svelte`
- `src/routes/guide/+page.svelte`
- `src/routes/mentions-legales/+page.svelte`
- `src/routes/sources/+page.svelte`
- `src/routes/politique-confidentialite/+page.svelte`

**Procedure:**

For each file: locate the `<aside class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">` block. Replace with:

```svelte
<Callout variant="warning">
  {/* body verbatim */}
</Callout>
```

Add the import at the top of `<script>`:

```svelte
import Callout from '$lib/components/ui/Callout.svelte';
```

The amber surface was static (no title), so just the body content moves. Tokens are: `bg-warning text-warning-foreground border-warning/40` (Callout handles them).

**Verify:**

- `rg "bg-amber-50" src/` → 0 hits
- `npm test -- --run` → green
- Visual: optionally screenshot one of the 7 surfaces (e.g., `routes/cgu/+page.svelte`) before/after — should look near-identical.

**Commit:**

```
git add src/routes/cgu/+page.svelte src/routes/allergens/+page.svelte src/routes/+page.svelte src/routes/guide/+page.svelte src/routes/mentions-legales/+page.svelte src/routes/sources/+page.svelte src/routes/politique-confidentialite/+page.svelte
git commit -m "refactor(ui): migrate 7 amber callouts to <Callout variant=warning>"
```

---

## Task 2: Pill-CTA migration

**Files modified (audit said ~9 sites):**

- `src/lib/components/bento/MonitorTimer.svelte:48`
- `src/lib/components/bento/OnboardingForm.svelte:63`
- `src/lib/components/bento/AddSymptomSheet.svelte:109`
- `src/lib/components/landing/LandingHeroBento.svelte:22,29`
- `src/lib/components/AppShellBento.svelte:122`
- `src/routes/login/+page.svelte:128,188`
- `src/routes/signup/+page.svelte:187`

**Procedure:**

Each callsite currently builds a button manually: `<button class="rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-soft …">…</button>` (or variations with `tile-*` colors, `disabled:opacity-50`, etc.). Replace with:

```svelte
<Button size="pill" variant="default" /* or tile-* */ class="shadow-soft">
  {/* body */}
</Button>
```

- For `bg-primary` originals → `variant="default"` (already covers `bg-primary text-primary-foreground`).
- For tile-color originals → `variant="tile-mint" | "tile-peach"` etc.
- Add `class="shadow-soft"` only if the original had `shadow-soft` (Button's pill size doesn't include shadow).
- Preserve `disabled`, `onclick`, `href`, `type` props verbatim.
- Drop the inline className for `font-bold` / `rounded-full` / size — pill size handles them.

If a callsite uses raw `<a class="rounded-full…">` (link not button), use `<Button size="pill" href="...">` (Button supports href).

Add the import where needed:

```svelte
import Button from '$lib/components/ui/Button.svelte';
```

**Verify:**

- `rg "rounded-full bg-primary" src/` → 0 hits
- `rg "rounded-full" src/lib/components/bento src/routes/login src/routes/signup src/lib/components/landing src/lib/components/AppShellBento.svelte` → only legitimate non-CTA uses (e.g., avatar)
- `npm test -- --run` → green

**Commit:**

```
git add <changed files>
git commit -m "refactor(ui): migrate inline pill CTAs to <Button size=pill>"
```

---

## Task 3: Section-label migration

**Files modified (audit said 28 inline labels):**

- `src/lib/components/bento/StageDetailSheet.svelte:28,37,47,51`
- `src/lib/components/bento/AddSymptomSheet.svelte:55`
- `src/lib/components/AllergenInfoDialog.svelte:92`
- `src/lib/components/bento/CarnetCategories.svelte:36`
- `src/routes/+page.svelte` (sources/allergens/guide sections)
- `src/routes/allergens/+page.svelte`
- `src/routes/guide/+page.svelte`
- `src/routes/account/*/+page.svelte` (various)
- `src/routes/child/[id]/settings/+page.svelte`
- Other discovery files

**Procedure:**

1. Find all candidates:

```bash
rg -n "text-xs font-semibold uppercase tracking-wider text-ink-soft" src/
rg -n "text-sm font-semibold uppercase tracking-wider text-ink-soft" src/
```

2. For each match:
   - If it's a `<p>` or `<h3>` element ABOVE a list/section, replace with `<SectionHeader size="sm">` (for `text-xs` cases) or `<SectionHeader size="md">` (for `text-sm`).
   - Preserve `mb-2`, `id`, `class` etc. via the `class` prop.
   - Skip cases where the classes are on a `<label>` (form labels, different semantics).
   - Skip cases inside a `DetailSheet` (those become `SheetSection` in Bundle 3, not now).

Add import:

```svelte
import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
```

**Verify:**

- Count drops: `rg "text-xs font-semibold uppercase tracking-wider text-ink-soft" src/ | wc -l` should be significantly lower (the remaining ones are the canonical `SectionHeader` and `SheetSection` internals).
- `npm test -- --run` → green
- Visual: spot-check 1-2 affected routes

**Commit:**

```
git add <changed files>
git commit -m "refactor(ui): migrate inline section labels to <SectionHeader>"
```

---

## Task 4: Outro-CTA migration

**Files modified:**

- `src/routes/allergens/+page.svelte:119`
- `src/routes/sources/+page.svelte:91`
- `src/routes/guide/+page.svelte:109`

**Procedure:**

Each of these three routes ends with a `<Card class="p-5 text-center md:p-6">` containing h2 + body + CTA Button. Replace with:

```svelte
<CalloutCard title={/* the h2 */} class="mt-8">
  {/* the body paragraph */}
  {#snippet action()}
    <Button href="/somewhere" variant="default">{/* CTA */}</Button>
  {/snippet}
</CalloutCard>
```

Note: `CalloutCard` uses dashed-border + centered layout. If the visual delta from `Card` is too large (e.g., the original used a solid border), revert to using `Card padding="lg" class="text-center"` — but try CalloutCard first, since it's the audit's recommendation.

If CalloutCard's dashed-border doesn't fit the marketing aesthetic, fall back to:

```svelte
<Card padding="lg" class="text-center">
  <h2 class="text-base font-semibold">{/* title */}</h2>
  <p class="mt-1 text-sm text-ink-soft">{/* body */}</p>
  <div class="mt-4"><Button href="...">{/* CTA */}</Button></div>
</Card>
```

— this still uses the new `padding` prop, just keeps the solid card surface.

**Verify:**

- `npm test -- --run` → green
- Visual: each of the 3 routes' outro section renders correctly

**Commit:**

```
git add src/routes/allergens/+page.svelte src/routes/sources/+page.svelte src/routes/guide/+page.svelte
git commit -m "refactor(ui): migrate 3 outro CTA cards to CalloutCard"
```

---

## Task 5: Visual-fix batch

**Files modified:**

- `src/lib/components/ui/Modal.svelte` (line ~466)
- `src/lib/components/bento/BentoMark.svelte` (line ~8)
- `src/app.css` (add `.tap-target` utility + tidy `.discover-group`)
- `src/lib/components/bento/DiscoverGroup.svelte` (replace inline CSS class with Tailwind)
- `tailwind.config.ts` (add radius-rule comment)
- Any 2 files containing `duration-200` (`rg "duration-200" src/`)
- Touch targets: apply `.tap-target` to icon buttons / sheet grabbers (~6 sites)

**Procedure:**

### 5a. Modal scrollable body

`src/lib/components/ui/Modal.svelte` line 466 area. Find the `scrollableBody` div that uses `max-h-[70vh]`. Replace `max-h-[70vh] overflow-y-auto` with `flex-1 min-h-0 overflow-y-auto` so the body fills the remaining space inside the 92dvh sheet.

The Modal shell at `side="bottom"`/`"auto"` uses `max-h-[92dvh]` (line 81). The scrollableBody div must therefore be a flex child of a flex column container. Check the existing structure — if the parent isn't already a flex column, wrap accordingly.

### 5b. BentoMark radius

`src/lib/components/bento/BentoMark.svelte` line 8. Replace `rounded-2xl` with `rounded-tile`.

### 5c. duration-200 → duration-base

```bash
rg -l "duration-200" src/
```

For each file, replace `duration-200` with `duration-base`. There should be exactly 2 hits.

### 5d. .discover-group inline CSS

`src/app.css` lines ~324-363 declare `.discover-group` with hand-rolled background tints. Move the per-data-tint logic into `src/lib/components/bento/DiscoverGroup.svelte` using Tailwind tile-color tokens (`bg-tile-mint/[0.18]`, `bg-tile-peach/[0.18]`, `bg-tile-butter/[0.18]` — pick 0.18 consistently). Delete the `.discover-group*` block from `src/app.css`.

### 5e. .tap-target utility

Add to `src/app.css` inside `@layer utilities` (if it exists, otherwise create the layer):

```css
@layer utilities {
  .tap-target {
    @apply min-h-11 min-w-11;
  }
}
```

Apply `.tap-target` to:

- `Modal.svelte`'s drag-grabber (the small horizontal bar at the top of bottom sheets) — only if it's a tap target.
- Sheet close buttons (Modal's built-in close X).
- Icon-only Buttons in the bottom nav.
- Severity chips in symptom UI.

Don't add it everywhere — target the obvious ones. The audit said 8 sites use `min-h-11`; aim to bring most icon-button surfaces up to standard.

### 5f. Radius rule comment

In `tailwind.config.ts`, find the `borderRadius` config (or the `extend.borderRadius` config — the tokens like `tile`, `hero`). Above it add a comment:

```ts
// Radius rule (Bundle 2):
//   - sm/md  → chips, inputs, small buttons
//   - tile   → cards, tiles (rounded-tile = ~16px)
//   - hero   → page-scale tiles, modals (rounded-hero = ~24px)
//   - full   → pills, badges, avatars
// If you need a new value here, the design has drifted — discuss first.
```

**Verify:**

- `rg "duration-200" src/` → 0 hits
- `rg "rounded-2xl" src/` → 0 hits (or only legitimate uses outside our scope — manually verify any remaining)
- `rg "bg-amber-50" src/` → 0 hits (from Task 1)
- `npm test -- --run` → green
- Manual spin-up of dev server: visit the Discover tab (DiscoverGroup), open a bottom sheet on mobile-emulated viewport (Modal scrollableBody), tap an icon button (.tap-target)

**Commit:**

```
git add src/lib/components/ui/Modal.svelte src/lib/components/bento/BentoMark.svelte src/app.css src/lib/components/bento/DiscoverGroup.svelte tailwind.config.ts <files with duration-200 hits>
git commit -m "refactor(ui): visual coherence fixes (Modal scroll, BentoMark radius, duration, .discover-group, .tap-target, radius rule)"
```

---

## Task 6: Graphify refresh + PR

- [ ] `graphify update .`
- [ ] `git add graphify-out/ && git commit -m "chore(graphify): refresh after Bundle 2 visual coherence sweep"`
- [ ] `git push -u origin feat/simplify/bundle-2-visual-coherence-sweep`
- [ ] `gh pr create --base feat/simplify/bundle-1-foundation-primitives --title "refactor(ui): visual coherence sweep (Bundle 2 of simplification spec)" --body "..."`

**PR body template:**

```markdown
## Summary

Migrates consumers onto Bundle 1's primitives and fixes the visual outliers the audit found. Visible-parity-preserving.

Stacked on PR #181 (Bundle 1).
Spec: `docs/superpowers/specs/2026-05-21-simplify-codebase-design.md`.
Plan: `docs/superpowers/plans/2026-05-21-bundle-2-visual-coherence-sweep.md`.

## Migrations

- 7 amber callouts → `<Callout variant="warning">` (warning token, dark-mode parity).
- ~9 inline pill CTAs → `<Button size="pill">`.
- 28 inline section labels → `<SectionHeader size="sm">`.
- 3 outro CTA cards (allergens, sources, guide) → `<CalloutCard>` (or `<Card padding="lg">`).

## Visual fixes

- `Modal.svelte` `scrollableBody`: `max-h-[70vh]` → `flex-1 min-h-0` (fixes ~22vh dead space on iPhone).
- `BentoMark.svelte`: `rounded-2xl` → `rounded-tile`.
- 2 × `duration-200` → `duration-base`.
- `.discover-group` ad-hoc CSS → Tailwind classes on `DiscoverGroup.svelte`.
- New `.tap-target` utility, applied to icon buttons / sheet grabbers / severity chips.
- 4-tier radius rule documented in `tailwind.config.ts`.

## Test plan

- [ ] `npm test -- --run` — green
- [ ] `rg "bg-amber-50" src/` — 0 hits
- [ ] `rg "rounded-2xl" src/` — 0 hits
- [ ] `rg "duration-200" src/` — 0 hits
- [ ] Manual: Discover tab, open + close bottom sheets, tap targets in nav

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Decision notes (carry forward to writing-plans or directly inline)

- If task 4's CalloutCard substitution looks wrong on the marketing pages (too informal with dashed border), fall back to `Card padding="lg"` per the inline note. Decide per page based on screenshots.
- Tap-target application in 5e is judgment-based: don't blanket-apply to every interactive element; pick the small touchpoints that currently fail the 44×44 WCAG target.
