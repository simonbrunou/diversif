# Allergen maintenance tracking

## Problem

`src/lib/server/guidance/reminders.ts` already prompts the caregiver to _introduce_ the seven priority allergens (rule 4 `pending-allergen:<id>`) and surfaces a `'todo'` state on the `/foods` bento for un-introduced ones. Once an allergen has been logged a single time, however, the app falls silent: there is no nudge to keep offering it, and the bento tile flips straight to `'cleared'`.

Current evidence-based guidance is **regular sustained exposure**, not single introduction:

- LEAP / NIAID 2017: ~2 g peanut protein × 3 / week, continued through age 5.
- ESPGHAN 2017 Position Paper: ~2 g / week of egg, peanut, tree nuts.
- ANSES (2019) + SPF / PNNS (2021): allergens "introduits **puis maintenus régulièrement** dans l'alimentation".

The reminder engine has a generic "Reproposez « X »" card (rule 6) for taste-acceptance repetition, but it triggers off any food that was logged once with `ras` / `inconfort` > 3 days ago — it is not allergen-aware, not priority-gated, and does not reflect the 1–3×/semaine cadence the sources actually describe.

## Goal

After a priority allergen has been logged at least once, surface a calm maintenance nudge once seven days have passed without re-exposure, so the caregiver keeps the allergen in rotation.

## Non-goals

- A "3 jours d'affilée" spacing rule for ordinary foods. The 2021 PNNS update + AFPA 2022 synthesis explicitly encourage daily variation; the 3-day folk rule is not in current guidance.
- A "surveiller ~2 h après la première exposition" dialog on first introduction.
- Per-child or per-allergen configurable thresholds.
- Maintenance tracking for non-priority allergens (céleri, moutarde, crustacés, mollusques, soja). LEAP / EAT / ESPGHAN did not cover them; surfacing the same cadence framing would misattribute the evidence — same reason rule 5 already gates on `PRIORITY_INTRODUCTION_ALLERGENS`.
- A new dashboard section. The existing `/foods` bento + dashboard reminder rail are the surfaces.
- A database migration. Everything derives from existing `foodEntries` + `foods.allergenType` rows.

## Surface

Two existing surfaces are extended:

1. **`/foods` bento — `AllergenItem.state`** gains a fourth value `'fading'`. The tile renders with a butter-200 background, label "À reproposer", caption "{N} j" where N is the days since `lastTried`. Reaction trumps fading: a priority allergen that has both `hasReaction` and a stale `lastTried` keeps `'reaction'`.
2. **Dashboard reminders rail** receives `maintain-allergen:<id>` cards, severity `info`, capped at 2, sorted oldest-exposure-first. Mirrors how rule 4 + bento `'todo'` already work as a pair.

## Threshold

**Seven days** since last exposure. Maps to ANSES's qualitative "régulièrement" and the lower bound of ESPGHAN's ~2 g/semaine target. Body text quotes the LEAP / ESPGHAN "2 à 3 fois par semaine" as the _ideal_, so caregivers see the ambitious target without being guilt-tripped at the threshold.

Per PRODUCT.md ("Régularité as a fact, never a guilt trip"), a tighter 3 or 4-day window would fire on normal weekend gaps and shift tone toward urgency. Seven days is a deliberate calm.

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
       AND daysSince(lastTried) > 7           → 'fading'   (NEW)
     else                                     → 'cleared'

ReminderInput.entries ──▶ computeReminders(input)
   rule 9 maintain-allergen (NEW):
     for id in PRIORITY_INTRODUCTION_ALLERGENS
       where id ∈ introducedAllergens
       and daysSinceLastExposure(id) > 7
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
- Compute the `'fading'` branch inside the final `ALLERGENS.map(...)` reducer. `'fading'` requires `b.triedCount >= 1`, `!b.hasReaction`, `a.id ∈ PRIORITY_INTRODUCTION_ALLERGENS`, and `daysSince(b.latest) > 7`.

### `src/routes/child/[id]/foods/+page.svelte`

- Add a render branch for `state === 'fading'`.
- Tile background: `--tile-butter-200` (`#ffeeb0`). Label: "À reproposer". Caption: "{days} j" using the existing `lastTried` formatter.
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

- priority allergen introduced 6 d ago → no maintain card
- priority allergen introduced 8 d ago → 1 maintain card
- three priority allergens slipping by 9 / 10 / 12 d → 2 cards, sorted oldest first (12 d card first, 10 d card second, 9 d card dropped)
- non-priority allergen (céleri) slipping 30 d → no maintain card
- priority allergen with `reaction` history and lastTried 14 d ago → no maintain card (reaction wins, surfaced elsewhere)
- dismissed `maintain-allergen:oeuf` → no card for `oeuf` but other slips still surface
- maintain reminders never push above the 4-card cap, and never displace `important` / `warn` cards

`src/routes/child/[id]/foods/+page.server.test.ts` (or sibling unit test on the helper):

- priority allergen with `lastTried` 8 d ago, no reaction → state `'fading'`
- priority allergen with `lastTried` 8 d ago, with reaction → state `'reaction'`
- non-priority allergen with `lastTried` 30 d ago → state `'cleared'`
- priority allergen never logged → state `'todo'`
- `now` is injectable for deterministic dates

`src/routes/child/[id]/foods/+page.svelte` (smoke / snapshot):

- a `'fading'` allergen item renders the "À reproposer" label and the "{N} j" caption against the butter-200 background.

## Sources

- LEAP — Du Toit et al., NEJM 2015 (early peanut introduction) — already cited in `sources.ts` as `leap-2015`.
- ESPGHAN 2017 Complementary Feeding Position Paper — already cited as `espghan-2017`.
- ANSES — Avis du 28 juin 2019 (allergens not to be delayed once diversification starts).
- Santé publique France / PNNS, _Le guide de l'alimentation des enfants de 0 à 3 ans_, 2021.
- AFPA, _Nouvelles recommandations du PNNS sur la diversification alimentaire_, Perfectionnement en Pédiatrie 2022.

## Open detail to resolve at plan time

- Confirm `EnrichedEntry.allergenType` exists in `src/lib/server/guidance/queries.ts`. If not, widen the projection (one-line change to the SELECT + the type).
- Confirm the source row for ANSES 2019 / PNNS 2021 already exists in `src/lib/content/sources.ts`. If not, add it as a new entry (citation only, no quoted content — the app cites, does not author).
