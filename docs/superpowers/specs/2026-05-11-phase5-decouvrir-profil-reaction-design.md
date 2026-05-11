# Phase 5 — Découvrir + Profil + Reaction Detail — Design Spec

**Date:** 2026-05-11
**Status:** approved, ready for implementation plan
**Tracks roadmap item:** Phase 5 of the bento UI/UX redesign (see `2026-05-10-ui-ux-redesign-design.md`)

## Problem

Phases 1–4 landed the bento foundation, app shell, FAB log flow, Aujourd'hui and Carnet. The redesign spec maps three remaining surfaces to Phase 5:

1. **Découvrir** — stages bento, suggestion feed, daily tip, sources cluster.
2. **Profil** — children, co-parents, account (passkeys / langue / thème / mot de passe), RGPD, légal.
3. **Reaction detail** — a calm, parent-facing view for a non-RAS food log with a structured symptom log and a printable pediatrician export.

Découvrir and Profil are mostly UI repackaging on existing loaders. Reaction detail is **new feature work** — a new `symptoms` table, an add-symptom flow, a 30-min monitoring timer, and a server-rendered HTML print page. Together they complete the four bottom-nav tabs of the bento shell and add the first "tense context" surface (reaction detail) styled with the same warmth as the celebratory ones — the cheer-everywhere PRODUCT.md principle made concrete.

## Goal

Ship the three remaining bento surfaces behind the existing `bentoEnabled` feature flag (owner allow-list + `bento=1` cookie). After Phase 5, every primary screen the parent reaches via the bottom nav is bento.

## Non-goals

- **No notification scheduling / push permissions.** Rappels deferred to a dedicated future spec. The 30-min timer is in-page only, persisted to localStorage.
- **No `/account` refactor.** Profil composes existing `/account` form actions. Update-profile, change-password, passkey CRUD, GDPR delete behaviors are untouched.
- **No new auth or landing pages.** Those are Phase 6.
- **No legacy route removal.** `/account`, `/passkeys`, `/sources`, `/suggestions`, `/guide` continue to work for non-flagged users. Phase 7 cleans them up.
- **No content rewrites for `/guide` stages.** Stage Sheets extract subsets of the existing `src/lib/content/guidance.ts` content; no new pediatric copy authored.
- **No symptom edit/delete.** Add-only for Phase 5. Corrections happen via a new corrective symptom row, like a paper medical chart. Edit/delete revisited in Phase 5.5 only if real-world use needs them.
- **No real-time multi-parent reconciliation.** Standard SvelteKit invalidation on form action; co-parents see new symptoms on the next load. No optimistic locking.

## Architecture

### Routes

| Path                                  | State         | Phase 5 behavior                                                                                                                                                                                                                     |
| ------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/child/[id]/guide`                   | replaces body | `DiscoverBento` when `bentoEnabled`; legacy guide rendered otherwise. URL preserved so the Découvrir tab matcher works and bookmarks survive.                                                                                        |
| `/account`                            | replaces body | `ProfilBento` when `bentoEnabled`; legacy account rendered otherwise.                                                                                                                                                                |
| `/child/[id]/foods/[entryId]`         | **new**       | Food-entry detail. For non-RAS reactions: full reaction-detail bento (reassurance hero, symptom list, stay-cool card, severe rail, primary + secondary CTAs). For RAS: minimal "aliment introduit · Nth exposition · RAS" mint card. |
| `/child/[id]/foods/[entryId]/print`   | **new**       | Server-rendered HTML print page (no JS, `@media print` CSS). Linked from the secondary CTA.                                                                                                                                          |
| `/child/[id]/suggestions`, `/sources` | unchanged     | Existing routes. Découvrir links to `/sources` for the full bibliography.                                                                                                                                                            |

### Feature flag

Same `bentoEnabled` pattern as Phase 3/4 — owner allow-list (env-driven) + `bento=1` cookie. Each new page reads the flag and falls back to legacy. No new flag.

### Database migration

One new table:

```sql
CREATE TABLE symptoms (
  id              SERIAL PRIMARY KEY,
  food_entry_id   INTEGER NOT NULL REFERENCES food_entries(id) ON DELETE CASCADE,
  child_id        INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  observed_at     TIMESTAMPTZ NOT NULL,
  label           TEXT NOT NULL,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX symptoms_food_entry_id_idx ON symptoms(food_entry_id);
CREATE INDEX symptoms_child_id_observed_at_idx ON symptoms(child_id, observed_at DESC);
```

Matches the existing serial-integer ID convention on `food_entries`, `children`, `users`. `created_by` is nullable + `ON DELETE SET NULL` to mirror `food_entries.logged_by`: when a co-parent is removed from a household, their symptom rows remain attached to the food entry but the author column becomes null.

`child_id` is denormalized for the future "all reactions for this child" pediatrician export without join. `ON DELETE CASCADE` on both FKs so the RGPD account-delete sweep reaches symptoms automatically.

Authorization: every read/write goes through `assertChildAccess(userId, childId)` (existing helper, used by all child-scoped reads). No direct symptom access without proven membership.

### Symptom vocabulary and severity

Severity is **derived** from the label, not stored. This keeps the parent's mental model simple ("I saw rougeur") while letting us evolve the severity mapping without a data migration.

```ts
// src/lib/content/symptoms.ts
export type SymptomLabel =
  | 'rougeur'
  | 'urticaire'
  | 'eczema'
  | 'vomissement'
  | 'diarrhee'
  | 'gonflement'
  | 'toux'
  | 'detresse-respiratoire'
  | 'levres-bleues'
  | 'autre';

export type Severity = 'neutral' | 'warn' | 'severe';

const SEVERE: ReadonlySet<SymptomLabel> = new Set([
  'gonflement',
  'detresse-respiratoire',
  'levres-bleues'
]);
const WARN: ReadonlySet<SymptomLabel> = new Set(['urticaire', 'eczema', 'vomissement', 'diarrhee']);

export function severityOf(label: SymptomLabel): Severity {
  if (SEVERE.has(label)) return 'severe';
  if (WARN.has(label)) return 'warn';
  return 'neutral';
}
```

FR labels rendered via paraglide message keys (`symptomsLabelRougeur`, etc.). The picklist order in `AddSymptomSheet` is fixed (defined in `symptoms.ts`) so it reads consistently for repeat users.

### Components added (~22)

**Découvrir** (5):

- `DiscoverBento` — root composer.
- `StagesBentoGrid` — 2×2 stage tiles.
- `StageDetailSheet` — bits-ui Sheet rendering one stage's content from `guidance.ts`.
- `SuggestionFeed` — vertical lilac feed (5 cards).
- `TipsRotator` — one butter `TipCard`, daily dismissible via existing `tip_dismissals` table.
- `SourcesCluster` — 5 sky tiles linking into `/sources`.

**Profil** (5):

- `ProfilBento` — root composer.
- `ChildCardRow` — one row per child (avatar disc + name + age + chevron). Tap → Drawer wrapping existing `/child/[id]/settings` form.
- `CoparentsSection` — list of memberships + invite row.
- `CompteSection` — four Sheet-wrapped rows: Passkeys / Langue / Thème / Mot de passe.
- `RgpdSection` — peach export row + butter delete row, both opening Sheets wrapping existing actions.

**Reaction detail** (7):

- `ReactionDetailBento` — root composer for non-RAS.
- `RasCard` — calm mint card for RAS entries.
- `ReassuranceHero` — peach Fraunces-italic block.
- `SymptomList` — chronological list.
- `SymptomRow` — one row, severity-tinted (neutral / butter / coral).
- `AddSymptomSheet` — Sheet with picklist + optional note + observed_at.
- `StayCoolCard` — mint reassurance card.
- `SevereRail` — coral one-tap `tel:15` rail, `role="alert"`.
- `MonitorTimer` — 30-min countdown, localStorage-persisted.
- `PrintFoodEntry` — server-rendered print page component.

**Shared utilities (1):**

- `useMonitorTimer` — Svelte hook ($effect-based) wrapping the localStorage-persisted countdown with `startedAt` timestamp + `durationMs`. Tick driven by `setInterval(1000)`, cleared on unmount. Reduced-motion honors the countdown but doesn't animate.

## Key screens

### Découvrir (replaces `/child/[id]/guide` body when flag on)

Vertical scroll, four blocks (no segmented control):

1. **Stages bento** (`StagesBentoGrid`) — 2×2 of `4-6m / 6-9m / 9-12m / 12m+`. Active stage gets a sage glow ring + `aria-current="step"`. Tile shows stage title (Fraunces italic), one-liner, icon. Tap → `StageDetailSheet`.
2. **Stage detail Sheet** (`StageDetailSheet`) — bits-ui Sheet, ~90% height. Renders that stage's content from `guidance.ts`: principles, focus foods, textures, milk target, red flags, source citations. Reuses existing `StageBadge`, `SourceCitation` primitives.
3. **Suggestions du jour** (`SuggestionFeed`) — vertical lilac feed, up to 5 cards. Each card shows food name, reason chip (one of: `priorité allergène` / `diversifie ta journée` / `pas essayé depuis 2 semaines`). Tap → existing LogSheet pre-filled with that food.
4. **Tips rotatifs** (`TipsRotator`) — one butter `TipCard` per day, dismissible. If dismissed today, the block is omitted entirely (honest empty states, no "nothing here today" placeholder).
5. **Sources scientifiques** (`SourcesCluster`) — 5 sky tiles (LEAP / EAT / ESPGHAN / ANSES / HCSP). Each tile taps to `/sources#<id>` (anchor-scrolled).

### Profil (replaces `/account` body when flag on)

Stacked sections, no segmented control:

1. **Child cards row** — one `ChildCardRow` per membership: avatar disc, name, age, "réglages →". Tap → Drawer wrapping `/child/[id]/settings`. Plus a dashed `+ Ajouter un enfant` row → existing add-child flow.
2. **Co-parents** — per-child list of memberships + `Inviter un co-parent` row → existing invitation flow.
3. **Compte** — four rows opening Sheets:
   - Passkeys (subtitle: "N appareils") — wraps `renamePasskey` / `deletePasskey` actions.
   - Langue (subtitle: current locale) — wraps existing locale toggle.
   - Thème (subtitle: current mode) — wraps existing `ThemeToggle`.
   - Mot de passe — wraps `changePassword` action.
4. **Vos données (RGPD)**:
   - Peach `Exporter mes données` row → existing `/account/export` route (kept as a downloadable JSON).
   - Butter `Supprimer mon compte` row → opens a Sheet wrapping the existing `deleteAccount` action. The Sheet preserves the email + password confirmation guards verbatim.
5. **Légal** — sage text links to `/cgu`, `/mentions-legales`, `/politique-confidentialite`, `/cookies`.

### Reaction detail (`/child/[id]/foods/[entryId]` — new)

**Non-RAS layout:**

1. Back link → Carnet (`localizedHref('/child/[id]/foods')`).
2. Title: `Réaction · {food}`. Sub: `{date} · {time} · {nth} exposition`. The `nth` exposition is computed by counting `food_entries` rows for `(child_id, food_id)` with `given_at <= entry.given_at`.
3. **ReassuranceHero** (peach, Fraunces italic): "On vous accompagne. Notez ce que vous observez — vous pourrez tout exporter pour le pédiatre."
4. **SymptomList** — chronological rows (`observed_at` ASC). Each `SymptomRow`: time + FR label + optional note. Severity → row background per `severityOf(label)`: neutral (white), warn (butter), severe (coral with `aria-live="polite"`). Empty state: muted "Aucun symptôme enregistré pour l'instant." Plus a `+ ajouter un symptôme` row → `AddSymptomSheet`.
5. **AddSymptomSheet** — bits-ui Sheet. Picklist of the 10 labels (rendered as a 2-column grid of pills). Free-form note input (max 280 chars, sanitized server-side). `observed_at` defaults to "now" with editable time. Sage "Enregistrer le symptôme" CTA. Submits to a SvelteKit form action `?/addSymptom` on the same route.
6. **StayCoolCard** (mint): "Respirez. Une réaction localisée se résout souvent seule. Surveillez 30 min." + link `Voir le guide réactions →` to `/child/[id]/guide#reactions`. Phase 5 adds an `id="reactions"` anchor on the existing red-flags section of `GuideStaticSections.svelte` (one-line change). No content authored.
7. **SevereRail** (coral, white text, `role="alert"`): "Difficulté à respirer / lèvres bleues ? Appelez le 15 immédiatement." Wrapped in `<a href="tel:15">` for one-tap dial. Always rendered, always last in the symptom group.
8. **Primary CTA** (sage): "Suivre 30 min · activer un timer" → starts a 30-min countdown via `useMonitorTimer`. Persists `{ startedAt: Date.now(), durationMs: 30 * 60 * 1000 }` in `localStorage` keyed by `monitor-timer:${entryId}`. While active, the button label flips to "Surveillance · MM:SS restantes". On expiry, a mint toast appears: "30 min écoulées. Si tout va bien, vous pouvez fermer cette page."
9. **Secondary CTA** (white outlined): "Exporter pour le pédiatre" → opens `/child/[id]/foods/[entryId]/print` in a new tab. Existing browser print/save-as-PDF takes over.

**RAS layout:** sections 1, 2, and a `RasCard` (mint, full-width): "Aliment introduit · Nth exposition · RAS — rien à signaler." No hero, no symptom list, no rails. Calm.

### Print page (`/child/[id]/foods/[entryId]/print`)

Server-rendered, no JS, no bento chrome. Pure ink-on-paper layout with `@media print` CSS hiding any nav. Structure:

1. Header: `Diversif · Journal de réaction` + child name, birth date, age in months.
2. Food entry: name, category, given_at (full date+time in FR locale), reaction enum.
3. Symptom log: chronological table — `observed_at` (HH:mm), label (FR), note. Severity not color-coded on print (B&W friendly) but tagged in a "Sévérité" column.
4. Footer: generated_at timestamp + "Document à présenter au pédiatre" + the diversif domain. No JS, no styling beyond a system font stack.

## Information architecture

- The four bottom-nav tabs (Aujourd'hui / Carnet / Découvrir / Profil) already wire to `/child/[id]`, `/child/[id]/foods`, `/child/[id]/guide`, `/account` respectively (Phase 3 work). Phase 5 just swaps the bodies of `/guide` and `/account` behind the flag — no nav changes.
- Reaction detail is reached from:
  1. A non-RAS `FoodCard` in Carnet (tap the whole card → `/foods/[entryId]`).
  2. A non-RAS `RecentFeed` row on Aujourd'hui (tap the row → `/foods/[entryId]`).
  3. The 48-hour ReminderStrip CTA. Phase 4 ships the reminder UI with a placeholder href; Phase 5 wires the CTA to the most recent non-RAS food entry's reaction-detail URL (one-line change in `+page.server.ts` for the Aujourd'hui loader's reminder builder).

## Data flow

**Découvrir page load** (`+page.server.ts` extends existing `/guide` loader):

```
parent layout → child (existing)
+ getStageForAgeMonths(months) → currentStageId
+ chooseSuggestedFoods({ starterFoods, recent, priorityAllergensTodo, now, count: 5 })
+ getTodayTipFor(userId, childId) — checks tip_dismissals
+ getStaticSources() — 5-item static list
```

**Profil page load** (`+page.server.ts` extends existing `/account` loader):

```
existing load → passkeys (kept)
+ getMyChildren(userId) — array of { child, role }
+ getCoparentsByChild(childId) — array, batched
+ getCurrentLocale, getCurrentTheme (from cookies — already available)
```

**Reaction detail page load** (`+page.server.ts` new):

```
assertChildAccess(userId, params.id)
→ load food entry by id (throw 404 if not found or wrong child)
→ load symptoms by food_entry_id (ASC by observed_at)
→ count nth exposition: SELECT count(*) FROM food_entries WHERE child_id = ? AND food_id = ? AND given_at <= ?
→ return { entry, symptoms, nth, food, severity computed per row }
```

**Add symptom form action** (`?/addSymptom`):

```
assertChildAccess
→ parse { label, note, observedAt } with zod schema (label is the SymptomLabel enum)
→ insert symptoms row
→ audit({ type: 'symptom.added', userId, childId, entryId, label })
→ return success (form invalidates the route, list re-renders with new row)
```

**Monitor timer:**

- Start: `localStorage.setItem('monitor-timer:${entryId}', JSON.stringify({ startedAt, durationMs }))`
- Tick: `$effect` polling `Date.now()` against `startedAt + durationMs`, updates `remainingMs` state.
- Expiry: toast + clear localStorage. No server call.
- Cross-tab: a `storage` event listener restarts the timer if the same key is set in another tab.

## Privacy / PII posture

Unchanged from earlier phases:

- No new third parties, no telemetry.
- `symptoms` table contains label keys (enum) + optional free-form note. The note may contain medical observation written by the parent — it's PII. Treated identically to `food_entries.notes` (already covered by the existing privacy policy section on "données d'alimentation").
- Print page is server-rendered HTML; nothing is sent to a third-party PDF service.
- The privacy policy needs **one line** added: "Les symptômes observés et notes associées sont stockés dans la table symptoms et supprimés en cascade lors de la suppression du compte ou de l'enfant."

## Migration / sequencing

The PR ships in this order so every commit is shippable. The feature flag keeps the new screens dark until each surface is fully wired.

1. DB migration + Drizzle schema + seed helper for `symptoms`.
2. `severityOf` + symptom label vocabulary + paraglide message keys.
3. Découvrir UI components (StagesBentoGrid, StageDetailSheet, SuggestionFeed, TipsRotator, SourcesCluster) — pure-UI.
4. Profil UI components (ProfilBento, ChildCardRow, CoparentsSection, CompteSection, RgpdSection) — pure-UI.
5. Reaction-detail UI components (ReactionDetailBento, ReassuranceHero, SymptomList, SymptomRow, AddSymptomSheet, StayCoolCard, SevereRail, MonitorTimer, RasCard) — pure-UI.
6. `useMonitorTimer` hook + tests.
7. New route `/child/[id]/foods/[entryId]/+page.server.ts` + `+page.svelte` — loader, addSymptom action, wires `ReactionDetailBento` or `RasCard`.
8. New route `/child/[id]/foods/[entryId]/print/+page.server.ts` + `+page.svelte` — server-rendered HTML, no JS.
9. Wire `DiscoverBento` into `/child/[id]/guide`. Loader extended to provide stages + suggestions + tip-dismissal state.
10. Wire `ProfilBento` into `/account`. Existing actions unchanged; the bento body calls them via Sheet-wrapped forms.
11. Link reaction detail from Carnet (non-RAS `FoodCard`) and Aujourd'hui (non-RAS `RecentFeed` row).
12. E2E specs (three new) at the pinned mobile viewport.
13. Privacy policy one-line addition.

## Testing & accessibility

### Unit / component (vitest, 100% coverage gate enforced)

- `severityOf` mapping — one test per label, plus an exhaustive "all SymptomLabel values are covered" check.
- Every new component: render, prop variants, RAS vs non-RAS branch on `ReactionDetailBento`.
- Every new server loader/action: pg-mem fixtures, including the "Nth exposition" count edge cases (1st, 2nd, deleted entries).
- `useMonitorTimer`: starts, persists, ticks down, expires, restores from localStorage across mount.

### E2E (Playwright, mobile viewport pinned)

- **Découvrir**: open `/child/[id]/guide` with `bento=1` → see four blocks → tap a stage → Sheet opens with that stage's content → close → return.
- **Profil**: open `/account` with `bento=1` → see all sections → tap Passkeys → Sheet opens with existing list → close → tap "Supprimer mon compte" → confirm Sheet renders (don't submit).
- **Reaction detail happy path**: log a non-RAS food → tap the row in RecentFeed → reaction-detail loads → add a symptom from picklist → row appears in list → severe rail is visible and `role="alert"` → open print → contains the symptom row.
- **RAS detail**: log a RAS food → tap the row → calm `RasCard` renders → no hero, no rails.
- **Print page smoke**: navigate to `/print` directly → page renders without bento chrome → no JS errors → key strings present.

### Accessibility

- `SevereRail` is reachable within 3 tabs from page load and announced via `role="alert"`.
- `tel:15` link covers the entire rail (full one-tap dial target).
- `AddSymptomSheet` traps focus, returns focus to the trigger on close.
- `aria-current="step"` on the active Stages tile.
- Print page is keyboard-reachable + screen-reader friendly (no decorative SVG without alt).
- Reduced-motion: the timer countdown still updates (functional) but doesn't pulse.
- Color contrast: every new tint pairing verified WCAG AA at 14px+.

### Visual regression

Three new baselines at 375px phone breakpoint, light + dark mode:

- `/child/[id]/guide?bento=1` (Découvrir, populated)
- `/account?bento=1` (Profil, with two children + two passkeys)
- `/child/[id]/foods/[entryId]?bento=1` (reaction-detail with two symptoms incl. one severe)

## Open questions

All five edge cases were resolved during brainstorming:

1. **Symptom edit/delete:** add-only in Phase 5. Corrections via new corrective row.
2. **Timer persistence:** localStorage only, no server-side.
3. **Concurrent symptom-add by co-parents:** standard SvelteKit invalidation; both see the new row on next load.
4. **Print page locale:** honors the URL locale prefix.
5. **Children outside 4–12 months on Stages grid:** still show all four stages; active highlight applies only when age falls in range.

No remaining ambiguity. Ready for implementation plan.
