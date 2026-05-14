# Late reaction promotion on a `ras` food entry

## Problem

When a caregiver logs a food entry as `ras` (rien à signaler) and the child has a delayed reaction hours later, there is currently no way to update that entry. The food-entry detail page is read-only for `reaction`, and `AddSymptomSheet` is only mounted on `ReactionDetailBento` — which never renders when `reaction === 'ras'`. The only workaround today is to delete and re-create the entry, which loses its `givenAt` timestamp and clutters the audit log.

## Goal

From the entry detail page, allow a caregiver to promote a `ras` entry to `inconfort` or `reaction` by adding a symptom, in a single tap.

## Non-goals

- Editing `reaction` in the downgrade direction (`reaction`/`inconfort` → `ras`).
- Editing `notes`, `givenAt`, food choice, or any other entry field.
- Bulk-editing or deleting symptoms.
- A separate "reaction history" view.

## Surface

`src/routes/child/[id]/foods/[entryId]/+page.svelte`, in the branch where `isRas === true` (currently renders `<RasCard>`).

Add a secondary action **"Signaler une réaction tardive"** below `RasCard`. Tapping it opens the existing `AddSymptomSheet` bound to the current `entry.id`. The sheet's form, fields, and `?/addSymptom` action are reused as-is.

`RasCard` itself is not modified; the button lives in the page, not the card component, to keep `RasCard` reusable elsewhere if needed.

## Server action

Reuse the existing `addSymptom` action in `src/routes/child/[id]/foods/[entryId]/+page.server.ts`.

After `insertSymptom(...)`, in the same transaction:

```
if (entry.reaction === 'ras') {
  const promoted = isSevereSymptomLabel(label) ? 'reaction' : 'inconfort';
  await tx.update(foodEntries).set({ reaction: promoted }).where(...);
}
```

Severity mapping (mirrors the existing symptom label enum):

| Symptom label                                                     | Promotes `ras` to |
| ----------------------------------------------------------------- | ----------------- |
| `urticaire`, `gonflement`, `respiration`                          | `reaction`        |
| `rougeur`, `eczema`, `vomissement`, `diarrhee`, `pleurs`, `autre` | `inconfort`       |

The promotion is idempotent: if `reaction !== 'ras'` when the action runs, the entry is left alone. Adding a second symptom to an already-promoted entry never changes its `reaction` again — only the first symptom on a `ras` entry promotes it.

The severity helper (`isSevereSymptomLabel`) lives next to the symptom label enum so the two stay in sync.

## Data model

No schema change. Existing `foodEntries.reaction` enum and `symptoms.foodEntryId` foreign key already support this.

## Audit / event log

Emit one new audit event on promotion (in addition to the existing `symptom.added`):

- Event name: `food_entry.reaction_promoted`
- Payload: `{ entryId, from: 'ras', to: 'inconfort' | 'reaction', triggeredBy: symptomId }`

Surface in the existing audit-event pipeline used by GDPR export and the coparent feed. Naming follows the dotted-resource pattern already used elsewhere in the codebase; confirm exact convention during planning.

## After submit

The SvelteKit load function re-runs on form submission. Because `reaction` is no longer `ras`, `isRas` is false and the view switches from `RasCard` to `ReactionDetailBento`, which lists the newly inserted symptom and continues to expose `AddSymptomSheet` for any further observations.

No client-side state management needed beyond what `enhance` already provides.

## French copy

Two new paraglide message keys:

- `lateReactionButton` — `"Signaler une réaction tardive"`
- `lateReactionSheetHint` (optional, only if UX testing shows the sheet is disorienting after a `ras`) — `"Décris ce que tu as observé après la prise."`

Exact keys may need disambiguation against existing `addSymptom*` keys; finalize during planning. No anglicisms; matches the project's French-only UI rule in CLAUDE.md.

## Tests

**Server (`page.server.test.ts`):**

1. `ras` entry + `addSymptom` with mild label (e.g. `rougeur`) → entry `reaction` becomes `inconfort`; symptom row inserted.
2. `ras` entry + `addSymptom` with severe label (e.g. `urticaire`) → entry `reaction` becomes `reaction`.
3. `inconfort` entry + `addSymptom` → entry `reaction` unchanged (`inconfort`).
4. `reaction` entry + `addSymptom` → entry `reaction` unchanged.
5. Audit event `food_entry.reaction_promoted` emitted exactly once on case 1 and 2; not emitted on cases 3 and 4.

**Component (`RasCard.test.ts` or page-level test):**

1. When entry is `ras`, button "Signaler une réaction tardive" is rendered.
2. Tapping it opens `AddSymptomSheet`.

Existing `AddSymptomSheet` tests do not need changes.

## Open questions for the plan

- Confirm the exact audit event naming convention by reading the existing event names in the schema and emitters.
- Confirm whether the symptom label enum currently uses `diarrhee` or `diarrhée` (with accent) — match that spelling in the severity map.
- Determine the best location for `isSevereSymptomLabel` (likely `src/lib/server/symptoms.ts` if it exists, otherwise inline next to the enum).
