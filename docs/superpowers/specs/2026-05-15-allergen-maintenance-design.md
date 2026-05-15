# Allergen maintenance tracking

## Problem

`src/lib/server/guidance/reminders.ts` already prompts the caregiver to _introduce_ the seven priority allergens (rule 4 `pending-allergen:<id>`) and surfaces a `'todo'` state on the `/foods` bento for un-introduced ones. Once an allergen has been logged a single time, however, the app falls silent: there is no nudge to keep offering it, and the bento tile flips straight to `'cleared'`.

Current evidence-based guidance is **regular sustained exposure**, not single introduction:

- LEAP / NIAID 2017: ~2 g peanut protein × 3 / week, continued through age 5.
- ESPGHAN 2017 Position Paper: ~2 g / week of egg, peanut, tree nuts.
- ANSES (2019) + SPF / PNNS (2021): allergens "introduits **puis maintenus régulièrement** dans l'alimentation".

The reminder engine has a generic "Reproposez « X »" card (rule 6) for taste-acceptance repetition, but it triggers off any food that was logged once with `ras` / `inconfort` > 3 days ago — it is not allergen-aware, not priority-gated, and does not reflect the 1–3×/semaine cadence the sources actually describe.

## Goal

After a priority allergen has been logged at least once, surface a calm maintenance nudge once four days have passed without re-exposure, so the caregiver keeps the allergen in rotation at the evidence-based 2–3×/semaine target.

## Non-goals

- A "3 jours d'affilée" spacing rule for ordinary foods. The 2021 PNNS update + AFPA 2022 synthesis explicitly encourage daily variation; the 3-day folk rule is not in current guidance.
- A "surveiller ~2 h après la première exposition" dialog on first introduction.
- Per-child or per-allergen configurable thresholds.
- Maintenance tracking for non-priority allergens (céleri, moutarde, crustacés, mollusques, soja). LEAP / EAT / ESPGHAN did not cover them; surfacing the same cadence framing would misattribute the evidence — same reason rule 5 already gates on `PRIORITY_INTRODUCTION_ALLERGENS`.
- A new dashboard section. The existing `/foods` bento + dashboard reminder rail are the surfaces.
- A database migration. Everything derives from existing `foodEntries` + `foods.allergenType` rows.

## Surface

Two existing surfaces are extended:

1. **`/foods` bento — `AllergenItem.state`** gains a fourth value `'fading'`. The tile renders with a peach-200 background, label "À reproposer", caption "{days} j" where `days` is the days since `lastTried`. Reaction trumps fading: a priority allergen that has both `hasReaction` and a stale `lastTried` keeps `'reaction'`.
2. **Dashboard reminders rail** receives `maintain-allergen:<id>` cards, severity `info`, capped at 2, sorted oldest-exposure-first. Mirrors how rule 4 + bento `'todo'` already work as a pair.

## Threshold

**Four days** since last exposure. Maps to the lower bound of the LEAP / ESPGHAN "2 à 3 fois par semaine" target: missing four days means the child has fallen below 2×/semaine. Body text quotes the same 2–3×/semaine framing so the caregiver sees the target the threshold is derived from.

A 7-day floor was the first instinct (matches ANSES's qualitative "régulièrement"), but it only catches a child who has skipped a full week — it does not protect the actual 2–3× target. Calm tone is not produced by lax timing; it lives in the copy and in `severity: 'info'`. The reminder reads "Bébé n'a pas eu œuf depuis 4 jours, l'idéal est…", not "En retard !". A tighter 3-day floor would match LEAP's literal 3×/semaine for peanut but would fire on routine Friday-to-Monday gaps for the other six allergens, so 4 days is the calmer evidence-aligned choice.

## Reminder card shape

```text
key:         'maintain-allergen:<id>'
severity:    'info'
title:       'Reproposez « {label} »'
body:        'Bébé n'a pas eu {label} depuis {days} jours. L'idéal
              est d'en reproposer 2 à 3 fois par semaine pour
              entretenir la tolérance.'
cta:         { label: 'Voir les suggestions',
               href: '<childPath>/suggestions?allergen=<id>' }
sources:     ['leap-2015', 'espghan-2017', 'anses-nourrisson']
dismissable: true
```

Dismissal honours the existing TTL mechanism. The card re-surfaces if dismissed and the gap continues to grow — same behaviour as the other `info` reminders.

## Data flow

```text
food_entries × foods.allergen_type ──▶ loadBentoAllergens(childId, now?)
   per allergen:
     no bucket                                → 'todo'
     hasReaction                              → 'reaction'
     id ∈ PRIORITY_INTRODUCTION_ALLERGENS
       AND daysSince(lastTried) > 4           → 'fading'   (NEW)
     else                                     → 'cleared'

ReminderInput.entries ──▶ computeReminders(input)
   rule 9 maintain-allergen (NEW):
     for id in PRIORITY_INTRODUCTION_ALLERGENS
       where id ∈ introducedAllergens
       and daysSinceLastExposure(id) > 4
     emit Reminder, sort oldest first, slice(0, 2)
```

Maintenance reminders sit at `severity: 'info'`, so they sort below the existing `important` and `warn` reminders in `SEVERITY_RANK` and never displace stage transitions, pending-allergen cards, or forbidden-food warnings under the 4-card cap.

## Components

### `src/lib/server/guidance/reminders.ts`

- Add rule 9 inside `computeReminders`, after rule 8.
- Computation: derive `lastExposureByAllergen: Map<AllergenId, number>` from `input.entries` joined against the allergen type of each entry's food.
- Requires `EnrichedEntry` to carry the food's `allergenType` (string | null). Confirm at plan time in `src/lib/server/guidance/queries.ts`. If absent, widen `EnrichedEntry` and the SELECT in `queries.ts` — small additive change.

### `src/routes/child/[id]/foods/+page.server.ts`

- Extend `AllergenItem.state` union with `'fading'`.
- `loadBentoAllergens` takes an optional `now?: Date` for deterministic tests (mirrors `loadWeeklyEntries`).
- Compute the `'fading'` branch inside the final `ALLERGENS.map(...)` reducer. `'fading'` requires `b.triedCount >= 1`, `!b.hasReaction`, `a.id ∈ PRIORITY_INTRODUCTION_ALLERGENS`, and `daysSince(b.latest) > 4`.

### `src/routes/child/[id]/foods/+page.svelte`

- Add a render branch for `state === 'fading'`.
- List-item background: `bg-tile-peach/20` (mirrors how `'reaction'` uses `bg-tile-coral/20`). Pill background: `bg-tile-peach` (`#ffd9c0`). Pill label: "À reproposer". Caption substitutes the lastTried date with "{days} j" — i.e. "1× · 5 j" instead of "1× · 2026-04-15" when fading. Butter is already taken by `'todo'`; peach is the calm-attention slot.
- The other three states keep their current visual treatment.

### `src/lib/content/sources.ts`

- Ensure `anses-nourrisson` (or equivalent ANSES 2019 / SPF PNNS 2021 source row) exists. If missing, add with citation only — the app does not paraphrase the source content.

### i18n

New message keys in `messages/fr/` and `messages/en/`:

| Key                                | FR                                                                                                                            | EN                                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `allergens.fadingLabel`            | À reproposer                                                                                                                  | To re-offer                                                                              |
| `allergens.fadingCaption`          | {days} j                                                                                                                      | {days} d                                                                                 |
| `reminders.maintainAllergen.title` | Reproposez « {label} »                                                                                                        | Re-offer « {label} »                                                                     |
| `reminders.maintainAllergen.body`  | Bébé n'a pas eu {label} depuis {days} jours. L'idéal est d'en reproposer 2 à 3 fois par semaine pour entretenir la tolérance. | Baby hasn't had {label} for {days} days. Aim for 2–3 times a week to maintain tolerance. |
| `reminders.maintainAllergen.cta`   | Voir les suggestions                                                                                                          | See suggestions                                                                          |

No anglicisms. The FR copy uses « » and `–` (en-dash) for ranges, matching the typographic conventions already in `reminders.ts` (e.g. "fenêtre 4–11 mois").

## Data model

No schema change. `food_entries.given_at` + `foods.allergen_type` are sufficient.

## Audit / event log

No new audit event. Dismissals already flow through the existing reminder-dismissal mechanism. The maintenance rule is purely derived state; nothing is written.

## Error handling

- `lastTried = null` is impossible by construction (only buckets with at least one entry have a date) and is treated as ineligible.
- `daysSince < 0` (clock skew, future-dated entries) is clamped at 0 — the entry is treated as fresh.
- `allergenType` rows that are not in `PRIORITY_INTRODUCTION_ALLERGENS` are ignored for maintenance (kept on `'cleared'` / `'reaction'`).
- Missing `EnrichedEntry.allergenType` (if the field is added but not back-filled for older callers): the rule treats the entry as having no allergen and ignores it. No exception thrown.

## Testing

`src/lib/server/guidance/reminders.test.ts`:

- priority allergen last logged 3 d ago → no maintain card
- priority allergen last logged 5 d ago → 1 maintain card
- three priority allergens slipping by 6 / 7 / 9 d → 2 cards, sorted oldest first (9 d card first, 7 d card second, 6 d card dropped)
- non-priority allergen (céleri) slipping 30 d → no maintain card
- priority allergen with `reaction` history and lastTried 8 d ago → no maintain card (reaction wins, surfaced elsewhere)
- dismissed `maintain-allergen:oeuf` → no card for `oeuf` but other slips still surface
- maintain reminders never push above the 4-card cap, and never displace `important` / `warn` cards

`src/routes/child/[id]/foods/+page.server.test.ts` (or sibling unit test on the helper):

- priority allergen with `lastTried` 5 d ago, no reaction → state `'fading'`
- priority allergen with `lastTried` 5 d ago, with reaction → state `'reaction'`
- non-priority allergen with `lastTried` 30 d ago → state `'cleared'`
- priority allergen never logged → state `'todo'`
- `now` is injectable for deterministic dates

`src/routes/child/[id]/foods/+page.svelte` (smoke / snapshot):

- a `'fading'` allergen item renders the "À reproposer" label and the "{N} j" caption against the peach-200 background.

## Sources

- LEAP — Du Toit et al., NEJM 2015 (early peanut introduction) — already cited in `sources.ts` as `leap-2015`.
- ESPGHAN 2017 Complementary Feeding Position Paper — already cited as `espghan-2017`.
- ANSES — Avis du 28 juin 2019 (allergens not to be delayed once diversification starts).
- Santé publique France / PNNS, _Le guide de l'alimentation des enfants de 0 à 3 ans_, 2021.
- AFPA, _Nouvelles recommandations du PNNS sur la diversification alimentaire_, Perfectionnement en Pédiatrie 2022.

## Resolved during plan exploration

- `EnrichedEntry.allergenType: string | null` already exists in `src/lib/server/guidance/queries.ts:17` and is already projected by `loadRecentEntries`. No widening needed.
- `anses-nourrisson` source row already exists in `src/lib/content/sources.ts:67`. No new source needed.
- `AllergenItem` type is duplicated in three places: `src/routes/child/[id]/foods/+page.server.ts:8`, `src/lib/components/bento/CarnetBento.svelte:19`, and `src/lib/components/bento/CarnetAllergens.svelte:7` (named `Item` there). All three need the `'fading'` widening.
