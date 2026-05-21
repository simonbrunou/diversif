# Discover tab — grouped layout

**Date:** 2026-05-21
**Status:** Approved by user during brainstorm 2026-05-21

## Why

The Discover tab grew to eight sections (`StagesBentoGrid`, `AllergenPassport`, `TextureTimeline`, `SeasonalFoods`, `Recipes`, `SuggestionFeed`, `DidYouKnow`, `SourcesCluster`). Each is well-designed in isolation, but stacked vertically with identical visual weight they read as cramped: a long undifferentiated scroll where nothing tells the eye where one mental beat ends and the next begins.

The content is good and stays. The presentation needs hierarchy and breathing room.

## What

Group the eight sections into three semantically-named groups, give each group a soft tinted background derived from the existing design tokens, and add real vertical breathing room between groups. The mental model becomes:

- **Repères** — "where am I right now"
- **À essayer** — "what could I do next"
- **Apprendre** — "what's the science"

Confirmed via the visual companion (option A + variant A2).

## Layout structure

```
DiscoverBento
└── div.flex.flex-col

    ── DiscoverGroup (tint = mint, label = "Repères") ──
    │   ├── StagesBentoGrid
    │   ├── AllergenPassport
    │   └── TextureTimeline

    ── DiscoverGroup (tint = peach, label = "À essayer") ──
    │   ├── SeasonalFoods
    │   ├── Recipes
    │   └── SuggestionFeed

    ── DiscoverGroup (tint = butter, label = "Apprendre") ──
    │   ├── DidYouKnow
    │   └── SourcesCluster
```

The three sections inside each group keep their existing internal designs, props, and tests. The only structural change is that they are siblings of a new `DiscoverGroup` wrapper instead of direct siblings of the `flex-col` container.

### Group order

Top-to-bottom: Repères → À essayer → Apprendre. This matches the user's likely intent (orient → act → learn) and keeps the most actionable cluster ("À essayer") near the top of the visual midline, where suggestions and recettes are most likely to convert into a logged food.

## Visual treatment

### Group container (`DiscoverGroup.svelte`)

- Outer wrapper: rounded `2xl`, padding `p-3` (mobile) / `p-4` (≥sm), margin-bottom `mb-6` between groups, no border.
- Background tint: HSL token at low alpha so the existing per-section card colours still pop on top.
  - `Repères` → `hsl(var(--tile-mint) / 0.18)`
  - `À essayer` → `hsl(var(--tile-peach) / 0.18)`
  - `Apprendre` → `hsl(var(--tile-butter) / 0.16)`
- Label: small uppercase, `tracking-wider`, `text-xs`, foreground in the matching `--tile-*-foreground` token at full alpha (already AA-rated). Positioned top-left inside the group, with a `mb-2` gap to the first inner card.
- The label is rendered as a non-heading element (`<p>` with `aria-hidden="true"`). The section's accessible name comes from `aria-label` on the `<section>` itself. This avoids creating a second `<h2>` next to each inner section's `SectionHeader` (which uses `<h2>` by default — `src/lib/components/ui/SectionHeader.svelte:8`), preserving the existing heading hierarchy without having to flip all eight inner section headers to `<h3>`.
- No inner divider between sections; let the per-section `SectionHeader` continue to mark each one.

The 0.18 / 0.16 alpha values are deliberately quiet — the existing dark-mode palette already uses tile-\* at full saturation for the suggestion tiles, so a faded background tint keeps the hierarchy: section cards still feel like "the thing", group tint feels like "the room they're in".

### Dark mode

Same HSL tokens, same alphas. The `--tile-*` tokens are already dark-mode-aware (see `src/app.css` lines 52–57 and 96–110 if the dark block is present). No additional work.

### Spacing rhythm

- Within a group: existing per-section spacing (each component already brings its own `mb-*`)
- Between groups: `mb-6` on the group wrapper (≈24 px)
- Top of page: keep existing `pt-*` from the route layout

## API: `DiscoverGroup.svelte`

```svelte
<script lang="ts">
  type Tint = 'mint' | 'peach' | 'butter';

  let { label, tint, children }: { label: string; tint: Tint; children: Snippet } = $props();
</script>

<section class="discover-group" data-tint={tint} aria-label={label}>
  <p class="discover-group__label" aria-hidden="true">{label}</p>
  {@render children()}
</section>
```

Plus a single CSS rule block (in `src/app.css` or a small co-located `<style>` block) that maps `data-tint` to the right `background-color` and label `color` token.

### Why a component, not just inline divs

- The tint/label binding is repeated three times — extracting prevents drift if we add or rename a group later
- Easier to test (one `.test.ts` file covers all three tints via parameterised cases)
- The label is localised once and follows the rest of the i18n flow (`messages/{fr,en}.json` get three new keys: `discoverGroupReperes`, `discoverGroupAEssayer`, `discoverGroupApprendre`)

## What does NOT change

- Per-section component internals (`StagesBentoGrid`, `AllergenPassport`, `TextureTimeline`, `SeasonalFoods`, `Recipes`, `SuggestionFeed`, `DidYouKnow`, `SourcesCluster`) — none of their props, styles, or tests are modified
- `DiscoverBento.svelte` props — same surface as today
- Server load (`+page.server.ts`) — unchanged
- Page-level test (`page.server.test.ts`) — unchanged
- Existing 100% coverage threshold — must be preserved

## What's explicitly out of scope

- **Hero / "Aujourd'hui" card** at the top of the tab — explored during brainstorm, deferred. There is no clear data source today that maps to "the one thing to look at first", and adding one would re-introduce the tip-of-the-day problem (PR #177) where stale content presented as fresh erodes trust. If we revisit, it's a separate spec.
- **Sub-tabs / hidden groups** (option B from the brainstorm) — rejected because content discoverability matters more than per-screen calm here.
- **Bento mixed-size grid** (option C) — rejected for mobile-first reasons; would mostly flatten back to vertical anyway.
- **Renaming or reordering existing sections** — out of scope.
- **Reaction colour palette overlap** — `tile-mint` is also the colour for ras/success states. The group tint is at 0.18 alpha, the inner suggestion tiles use stronger saturation; perceptually they read as different surfaces. If usability testing surfaces confusion we can swap `Repères` to a non-mint token, but for now we accept the overlap.

## Tests

One new test file: `src/lib/components/bento/DiscoverGroup.test.ts`.

- Renders the visible label text (decorative `<p>` with `aria-hidden`)
- Exposes the label as the section's accessible name via `aria-label`
- Applies the correct `data-tint` attribute for each variant (`mint`, `peach`, `butter`)
- Renders the slotted children

Update `DiscoverBento.test.ts` only if assertions on existing section headings break (they should not — each section keeps its own `SectionHeader`).

Update `messages/fr.json` + `messages/en.json` snapshots if any test pins them.

## Risk / open items

- **Vertical depth.** With three padded groups stacked, the total scroll length grows a bit. Mitigated by `p-3` (not `p-6`) and `mb-6` (not `mb-10`). Measure after first deploy.
- **Visual heaviness on mobile.** Tints at 0.18 alpha tested cleanly in the mockup; verify on the running app at the smallest target width (375 px) before merging.
- **Tailwind arbitrary values.** The HSL-with-alpha syntax above (`hsl(var(--tile-mint) / 0.18)`) requires Tailwind to interpret `bg-[hsl(var(--tile-mint)/0.18)]` correctly. Use a small CSS rule in `app.css` keyed off `[data-tint='mint']` instead of an arbitrary class — cleaner and survives prettier passes.

## Files touched

| File                                             | Change                                                                                            |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `src/lib/components/bento/DiscoverGroup.svelte`  | **new** — wrapper with label + tint                                                               |
| `src/lib/components/bento/DiscoverGroup.test.ts` | **new** — coverage for the wrapper                                                                |
| `src/lib/components/bento/DiscoverBento.svelte`  | wrap the 8 children in 3 `<DiscoverGroup>` wrappers                                               |
| `src/app.css`                                    | three small selectors for `[data-tint='mint'/'peach'/'butter']` setting background + label colour |
| `messages/fr.json` + `messages/en.json`          | three new i18n keys for the group labels                                                          |
| `src/lib/components/bento/DiscoverBento.test.ts` | only if existing assertions break — likely a no-op                                                |

No DB, no migration, no server change. Single-PR scope.
