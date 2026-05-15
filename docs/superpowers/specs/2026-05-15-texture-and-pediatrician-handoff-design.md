# Texture progression + Bilan pour le pédiatre

Two related additions to the food log: a texture/consistance field on every entry, and a printable synthesis of the child's diversification record for the medical visit. Shipped as two PRs in this order.

## Problem

PRODUCT.md describes the parent's recurring questions at calm moments as _« avons-nous introduit assez de variété ? »_ and _« avons-nous essayé les allergènes prioritaires ? »_. The app answers both. It does not yet answer the third question every French pediatrician asks at the 9-month and 12-month visits:

- _« Sur quelles textures est-il rendu ? Lisse, écrasée, morceaux ? »_

The HCSP, ANSES and AFPA all describe a roughly month-by-month texture progression (lisse → moulinée → écrasée → petits morceaux → morceaux) with finger food / DME in parallel from ~7 mo. The app captures which foods, when, and with what reaction — but not how they were served. The parent reaching for a fact at the visit has to recall it.

The pediatrician visit itself is a second gap. The existing `/child/[id]/report` route already synthesizes foods grouped by category, first/last given, worst reaction, exposures, and an allergens block. It is not framed as a hand-off document, has no print layout, and omits two things the pediatrician will ask: priority-allergen status per allergen, and where the child sits on the stage texture progression.

## Goal

1. Let the parent record (or accept a sensible default for) the texture of every food entry, and surface that record in the carnet, the entry detail, and a new bilan tile.
2. Reframe `/child/[id]/report` as _« Bilan pour le pédiatre »_ — print-clean, allergen-by-allergen, stage-aware — so the parent can walk into the consultation with one printed page that answers the standard questions.

## Non-goals

- Server-side PDF generation. Browser print (`window.print()` → save-as-PDF) is enough for a self-hosted app; adding a Chromium binary or a PDF library to the container is disproportionate.
- Multi-texture per entry. One food per entry already, mixed meals are already two entries.
- Logging texture-by-food charts, time-series, or per-allergen texture history.
- Comparing textures across siblings.
- Push notifications for the medical visit.
- A separate route for the handoff. The existing `/report` route is extended in place; navigation label changes, the URL does not.

## Feature 1 — Texture progression

### Data model

A nullable enum column `texture` on `food_entries` (`src/lib/server/db/schema.ts:122`):

| key               | label (FR)      | label (EN)        | stage default range  |
| ----------------- | --------------- | ----------------- | -------------------- |
| `lisse`           | Lisse           | Smooth purée      | ~4–6 mo              |
| `moulinee`        | Moulinée        | Blended           | ~6–7 mo              |
| `ecrasee`         | Écrasée         | Mashed            | ~7–9 mo              |
| `petits-morceaux` | Petits morceaux | Small soft pieces | ~9–12 mo             |
| `morceaux`        | Morceaux        | Pieces            | >12 mo               |
| `finger`          | Finger food     | Finger food       | from ~7 mo, parallel |

Migration `drizzle/0005_food_entry_texture.sql`:

```sql
ALTER TABLE food_entries
  ADD COLUMN texture TEXT
  CHECK (texture IN ('lisse', 'moulinee', 'ecrasee', 'petits-morceaux', 'morceaux', 'finger'));
```

No backfill — `NULL` means _« non renseignée »_ and is rendered as no badge (not as a placeholder). The CHECK constraint guards the form action and any direct SQL.

A `TEXTURE_VALUES` const + `TextureKey` type live in `src/lib/utils/textures.ts` (new file). The order of `TEXTURE_VALUES` is the progressive order above; `finger` is last because it is the parallel option.

### Default selection

The log sheet pre-selects the texture matching the child's current stage via `getStageForAgeMonths()` (`src/lib/content/guidance.ts`). The mapping from stage to default texture key is colocated with `TEXTURE_VALUES` to keep the source of truth singular:

| stage age range | default texture   |
| --------------- | ----------------- |
| 4 – <6 mo       | `lisse`           |
| 6 – <7 mo       | `moulinee`        |
| 7 – <9 mo       | `ecrasee`         |
| 9 – <12 mo      | `petits-morceaux` |
| ≥12 mo          | `morceaux`        |

`finger` is never the default — it is opt-in. A caption under the picker reads _« par défaut pour {ageMonths} mois — modifiable »_ on first render; it disappears once the parent has touched the picker for that entry. The "two taps to log" promise from PRODUCT.md §3 holds: confirm-with-no-tap or one tap to change.

### Log sheet UI

A new component `src/lib/components/TexturePicker.svelte` mirrors the shape of `ReactionPicker.svelte` — a row of tinted cards, single-selection radio, tabular numerals where relevant, focus ring matching brand sage. Six cards. On narrow viewports (~<360 px) the row wraps to two lines; this is fine since the cards are square-ish and remain thumb-sized.

A small `Ø` chip on the right of the row clears the selection back to `NULL`. There is no "Aucune" full-width option — that would invite parents to skip texture by default, defeating the point. The chip is there for the rare correction case.

Placement: directly below `ReactionPicker` in `src/routes/child/[id]/log/+page.svelte`, with the same caption typography.

### Carnet & entry detail

- **Feed row** (`src/routes/child/[id]/foods/+page.svelte`): a caption-style tag right of the food name, only rendered when `texture` is non-null. Same colour token as the existing meta row.
- **Entry detail** (`src/routes/child/[id]/foods/[entryId]/+page.svelte`): texture renders as a labelled row in the entry header, similar to how reaction is displayed.
- **Edit flow**: the existing entry-edit form gains the same `TexturePicker` with the current value pre-selected.

### CarnetStats — _« Textures explorées »_ tile

A new tile in `src/lib/components/bento/CarnetStats.svelte`: count of distinct non-null textures logged at least once, out of 6. Mint-200 token. Body: `{tried}/6`. Caption: list of textures still un-tried, comma-separated, truncated with ellipsis past the available width.

### Tests

- Migration: pg-mem applies `0005_food_entry_texture.sql`, the column exists, the CHECK constraint rejects `'foo'`.
- Form action (extend `src/routes/child/[id]/log/page.server.test.ts:97`): accepts each of the 6 valid textures, rejects `'invalid'` with a 400, persists the value, defaults to the stage-matching key when `texture` is omitted but `ageMonths` is in range.
- Entry-detail load + render: returns texture in the payload, the badge is visible when non-null and absent when null.
- CarnetStats: tile shows `0/6` for a fresh child, `3/6` after three distinct textures are logged.
- E2E smoke (`e2e/`): log a food, accept the default texture, see the badge in the feed.

## Feature 2 — Bilan pour le pédiatre

### Surface

The existing `/child/[id]/report` route is renamed in navigation to _« Bilan pour le pédiatre »_. The URL does not change. The page is restructured around three additions on top of what it already shows.

### Additions

1. **Allergen status block**, built from `loadBentoAllergens(childId)` (`src/routes/child/[id]/foods/+page.server.ts:29`). Priority allergens first, then the rest. Each row: name, state, last given date, total exposure count, worst reaction if any. State values are mapped for paper:
   - `cleared` → _« Introduit »_
   - `todo` → _« À introduire »_
   - `reaction` → _« Réaction observée »_
   - `fading` → _« Introduit »_ (collapsed; the maintenance-nudge state is irrelevant on the hand-off page)
2. **Stage status block**, built from `getStageForAgeMonths(ageMonths)`. Renders the current stage title and one-liner, the expected textures for the stage, and the **most-advanced texture logged so far**. If the logged texture is below the stage's expected textures, the row reads _« Texture la plus avancée enregistrée : {texture} »_ in calm body text — no warning icon, no colour shift, per PRODUCT.md §44 _honest, not breezy_.
3. **Textures distribution mini-bar**: 6 horizontal bars (one per texture key) showing share of entries in the last 30 days. Uses tabular nums. No legend — bars are labelled.

### Print layout

A dedicated print stylesheet for the route. Single column, A4, no chrome (FAB, top bar, nav, segmented controls all hidden via `@media print { display: none }`). Header carries child name, birth date, age in months. Footer reads _« Imprimé le {date} »_. The existing per-entry print page at `src/routes/child/[id]/foods/[entryId]/print/+page.svelte:115` is the precedent for stylesheet shape.

A _« Imprimer »_ button in normal view calls `window.print()`. The OS print dialog handles save-as-PDF. The button is `display: none` in print.

### Tests

- Loader (`src/routes/child/[id]/report/+page.server.ts`): returns priority-allergens-first, stage-status, texture distribution, total ordering deterministic.
- Stage gap: a 9-month-old with only `lisse` entries renders the _« Texture la plus avancée enregistrée : Lisse »_ row; a 9-month-old with `ecrasee` entries does not.
- Print stylesheet smoke (Playwright + WebKit): navigate to `/child/<id>/report`, force `emulate-media: print`, assert FAB hidden, button hidden, header visible.

## Risks

- **iOS Safari print quirks**. Mobile WebKit handles `@media print` differently from Chromium (background colours, font rendering, page breaks inside flex containers). Playwright's WebKit driver covers most of it; the residual risk is real-device-only behavior and is accepted.
- **Stage-default mismatch**. The default-texture mapping above is a single source of truth in `src/lib/utils/textures.ts`. If a future stages refactor splits or merges age windows in `guidance.ts`, the mapping table is what breaks first — caught by the form-action default test.
- **Texture progression is gradual; UI may suggest categorical**. The picker has six discrete options. Reality is a smear: parents might mix moulinée and écrasée in the same meal. We accept the categorical UX because storage must be categorical to aggregate, and because parents pick the dominant texture (mirroring how `reaction` already collapses a spectrum to three values).

## Sequencing

Two PRs, in order:

1. **Texture progression** — migration, schema, picker, log sheet, feed badge, entry detail, edit flow, CarnetStats tile, tests. Self-contained; no UX departure beyond the new picker.
2. **Bilan pour le pédiatre** — depends on the texture column existing in production (the stage-gap calculation references it). Extends `/report`, adds print stylesheet, renames navigation.

i18n keys land in `messages/fr.json` and `messages/en.json` alongside each PR.

## Out of scope (YAGNI)

- Server-side PDF generation.
- Multi-texture per entry.
- Push notifications for handoff reminders.
- Texture history-by-food charts.
- Comparing textures across siblings.
- A dedicated per-stage progress bar on `/child/[id]` (the page is deliberately not feature-rich, per PRODUCT.md anti-user).
- A `'fading'`-equivalent maintenance nudge for textures (would re-litigate the allergen-maintenance scoping decision).
