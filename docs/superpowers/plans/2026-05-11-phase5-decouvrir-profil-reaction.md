# Phase 5 — Découvrir + Profil + Reaction Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the three remaining bento surfaces (Découvrir, Profil, Reaction detail) behind the existing `bentoEnabled` feature flag, completing the four bottom-nav tabs and adding the first net-new feature work on the bento stack (symptoms table + add-symptom Sheet + 30-min monitor timer + server-rendered pediatrician print page).

**Architecture:** Phase 5 mirrors Phases 3 and 4: pure-UI components under `src/lib/components/bento/`, paraglide message keys for every string, feature-flag-gated body swaps on `/child/[id]/guide` and `/account`, and one new child-scoped route at `/child/[id]/foods/[entryId]`. Reaction detail introduces a `symptoms` table (serial-int IDs matching the existing convention), a `severityOf(label)` derivation, an in-page localStorage timer, and a print-friendly route that emits server-rendered HTML with `@media print` styles.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes ($props / $state / $derived / $effect), TailwindCSS 3 with bento tokens, Drizzle ORM + Postgres (pg-mem for tests), Paraglide-js (camelCase keys), Vitest + happy-dom + @testing-library/svelte for component tests, Playwright for e2e (mobile viewport pinned 414×896).

---

## Pre-flight context

Read these files once before starting (they hold patterns every task reuses):

- `src/lib/components/bento/StatTiles.svelte` + `.test.ts` — canonical bento component shape (Svelte 5 runes, paraglide imports, bento token classes).
- `src/lib/server/db/schema.ts:122-145` — `foodEntries` definition (serial-int IDs, integer FKs, `references(...).onDelete: 'cascade'` pattern).
- `src/lib/utils/suggest.ts` — `chooseSuggestedFood` baseline.
- `src/lib/feature-flags.ts` — `bentoEnabled` flag check pattern reused on every new route.
- `e2e/bento-shell.spec.ts` — mobile-viewport-pinned Playwright pattern.

Every task ends with a `git commit`. All commits land on the `worktree-feat-phase5-decouvrir-profil-reaction` branch.

---

## File structure

**New files (Drizzle + content):**

- `drizzle/0004_symptoms.sql`
- `src/lib/content/symptoms.ts` (+ `.test.ts`)

**New files (Découvrir):**

- `src/lib/components/bento/DiscoverBento.svelte` (+ `.test.ts`)
- `src/lib/components/bento/StagesBentoGrid.svelte` (+ `.test.ts`)
- `src/lib/components/bento/StageDetailSheet.svelte` (+ `.test.ts`)
- `src/lib/components/bento/SuggestionFeed.svelte` (+ `.test.ts`)
- `src/lib/components/bento/TipsRotator.svelte` (+ `.test.ts`)
- `src/lib/components/bento/SourcesCluster.svelte` (+ `.test.ts`)

**New files (Profil):**

- `src/lib/components/bento/ProfilBento.svelte` (+ `.test.ts`)
- `src/lib/components/bento/ChildCardRow.svelte` (+ `.test.ts`)
- `src/lib/components/bento/CoparentsSection.svelte` (+ `.test.ts`)
- `src/lib/components/bento/CompteSection.svelte` (+ `.test.ts`)
- `src/lib/components/bento/RgpdSection.svelte` (+ `.test.ts`)

**New files (Reaction detail):**

- `src/lib/components/bento/ReactionDetailBento.svelte` (+ `.test.ts`)
- `src/lib/components/bento/RasCard.svelte` (+ `.test.ts`)
- `src/lib/components/bento/ReassuranceHero.svelte` (+ `.test.ts`)
- `src/lib/components/bento/SymptomList.svelte` (+ `.test.ts`)
- `src/lib/components/bento/SymptomRow.svelte` (+ `.test.ts`)
- `src/lib/components/bento/AddSymptomSheet.svelte` (+ `.test.ts`)
- `src/lib/components/bento/StayCoolCard.svelte` (+ `.test.ts`)
- `src/lib/components/bento/SevereRail.svelte` (+ `.test.ts`)
- `src/lib/components/bento/MonitorTimer.svelte` (+ `.test.ts`)
- `src/lib/utils/monitor-timer.ts` (+ `.test.ts`)

**New routes:**

- `src/routes/child/[id]/foods/[entryId]/+page.server.ts` (+ `.test.ts` → `page.server.test.ts`)
- `src/routes/child/[id]/foods/[entryId]/+page.svelte`
- `src/routes/child/[id]/foods/[entryId]/print/+page.server.ts`
- `src/routes/child/[id]/foods/[entryId]/print/+page.svelte`

**Modified files:**

- `src/lib/server/db/schema.ts` (+ symptoms table definition + types)
- `src/lib/server/db/schema.test.ts` (+ symptoms assertions)
- `src/lib/utils/suggest.ts` (+ `chooseSuggestedFoods` plural)
- `src/lib/utils/suggest.test.ts`
- `src/lib/paraglide/messages.ts` is generated; we edit `messages/fr.json` + `messages/en.json` source files.
- `src/routes/child/[id]/guide/+page.server.ts` (+ Découvrir loader extension)
- `src/routes/child/[id]/guide/+page.svelte` (+ bento body swap)
- `src/routes/account/+page.server.ts` (+ Profil loader extension)
- `src/routes/account/+page.svelte` (+ bento body swap)
- `src/lib/components/bento/FoodCard.svelte` (+ link wrapper for non-RAS)
- `src/lib/components/bento/RecentFeed.svelte` (+ link wrapper for non-RAS)
- `src/lib/components/bento/ReminderStrip.svelte` is unchanged — the CTA `href` is built in the Aujourd'hui loader.
- `src/routes/child/[id]/+page.server.ts` (+ wire reminder CTA `href` to latest non-RAS food entry)
- `src/lib/components/GuideStaticSections.svelte` (+ `id="reactions"` anchor)
- `e2e/bento-discover.spec.ts` (new)
- `e2e/bento-profil.spec.ts` (new)
- `e2e/bento-reaction-detail.spec.ts` (new)
- `static/privacy-policy.html` or wherever the privacy policy lives (one-line addition) — task 35 finds the exact path.

---

## Tasks

### Task 1: Drizzle migration + schema for symptoms table

**Files:**

- Create: `drizzle/0004_symptoms.sql`
- Modify: `src/lib/server/db/schema.ts:202-234`
- Modify: `src/lib/server/db/schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Add to `src/lib/server/db/schema.test.ts` (after the imports block, append `symptoms` to the import list; add new `describe` block at end of file):

```ts
import { symptoms } from './schema';

describe('symptoms table', () => {
  it('is defined and has the expected columns', () => {
    expect(symptoms).toBeDefined();
    const cfg = getTableConfig(symptoms);
    const cols = cfg.columns.map((c) => c.name).sort();
    expect(cols).toEqual([
      'child_id',
      'created_at',
      'created_by',
      'food_entry_id',
      'id',
      'label',
      'note',
      'observed_at'
    ]);
  });

  it('indexes food_entry_id and (child_id, observed_at)', () => {
    const cfg = getTableConfig(symptoms);
    const idxNames = cfg.indexes.map((i) => i.config.name).sort();
    expect(idxNames).toContain('symptoms_food_entry_id_idx');
    expect(idxNames).toContain('symptoms_child_id_observed_at_idx');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/db/schema.test.ts`
Expected: FAIL — "symptoms is not defined" or import error.

- [ ] **Step 3: Add symptoms table to `schema.ts`**

Insert after `idempotencyKeys` (around line 216), before the type exports:

```ts
export const symptoms = pgTable(
  'symptoms',
  {
    id: serial('id').primaryKey(),
    foodEntryId: integer('food_entry_id')
      .notNull()
      .references(() => foodEntries.id, { onDelete: 'cascade' }),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
    label: text('label').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' })
  },
  (t) => ({
    foodEntryIdx: index('symptoms_food_entry_id_idx').on(t.foodEntryId),
    childObservedIdx: index('symptoms_child_id_observed_at_idx').on(t.childId, t.observedAt)
  })
);
```

And add to the type exports:

```ts
export type Symptom = typeof symptoms.$inferSelect;
export type NewSymptom = typeof symptoms.$inferInsert;
```

- [ ] **Step 4: Write the migration file**

Create `drizzle/0004_symptoms.sql`:

```sql
CREATE TABLE IF NOT EXISTS "symptoms" (
  "id" serial PRIMARY KEY NOT NULL,
  "food_entry_id" integer NOT NULL,
  "child_id" integer NOT NULL,
  "observed_at" timestamp with time zone NOT NULL,
  "label" text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_by" integer
);--> statement-breakpoint
ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_food_entry_id_food_entries_id_fk" FOREIGN KEY ("food_entry_id") REFERENCES "public"."food_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "symptoms_food_entry_id_idx" ON "symptoms" USING btree ("food_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "symptoms_child_id_observed_at_idx" ON "symptoms" USING btree ("child_id","observed_at");
```

Also update the existing `symptoms` import line in the test file:

```ts
import {
  users,
  sessions,
  children,
  memberships,
  invitations,
  foods,
  foodEntries,
  tipDismissals,
  passkeys,
  webauthnChallenges,
  symptoms
} from './schema';
```

And add `symptoms` to the existing "every table is defined" loop body.

- [ ] **Step 5: Run tests + commit**

Run: `npx vitest run src/lib/server/db/schema.test.ts`
Expected: PASS

```bash
git add drizzle/0004_symptoms.sql src/lib/server/db/schema.ts src/lib/server/db/schema.test.ts
git commit -m "feat(db): add symptoms table for reaction detail tracking"
```

---

### Task 2: Symptom vocabulary + severityOf

**Files:**

- Create: `src/lib/content/symptoms.ts`
- Create: `src/lib/content/symptoms.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/content/symptoms.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SYMPTOM_LABELS, severityOf, type SymptomLabel } from './symptoms';

describe('symptom vocabulary', () => {
  it('exposes 10 picklist labels', () => {
    expect(SYMPTOM_LABELS).toHaveLength(10);
  });

  it('every label maps to a known severity', () => {
    for (const label of SYMPTOM_LABELS) {
      expect(['neutral', 'warn', 'severe']).toContain(severityOf(label));
    }
  });
});

describe('severityOf', () => {
  it.each([
    ['gonflement', 'severe'],
    ['detresse-respiratoire', 'severe'],
    ['levres-bleues', 'severe'],
    ['urticaire', 'warn'],
    ['eczema', 'warn'],
    ['vomissement', 'warn'],
    ['diarrhee', 'warn'],
    ['rougeur', 'neutral'],
    ['toux', 'neutral'],
    ['autre', 'neutral']
  ] as const)('maps %s → %s', (label, expected) => {
    expect(severityOf(label as SymptomLabel)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/content/symptoms.test.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement the vocabulary**

Create `src/lib/content/symptoms.ts`:

```ts
export const SYMPTOM_LABELS = [
  'rougeur',
  'urticaire',
  'eczema',
  'vomissement',
  'diarrhee',
  'gonflement',
  'toux',
  'detresse-respiratoire',
  'levres-bleues',
  'autre'
] as const;

export type SymptomLabel = (typeof SYMPTOM_LABELS)[number];

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

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/content/symptoms.test.ts`
Expected: PASS

```bash
git add src/lib/content/symptoms.ts src/lib/content/symptoms.test.ts
git commit -m "feat(content): symptom picklist + severity derivation"
```

---

### Task 3: Paraglide message keys for Phase 5

**Files:**

- Modify: `messages/fr.json`
- Modify: `messages/en.json`

These keys feed every Phase 5 component. Add them all up front so subsequent tasks can compile.

- [ ] **Step 1: Add FR keys**

In `messages/fr.json`, add these camelCase keys (place them grouped by surface; the file uses flat camelCase keys):

```json
{
  "decouvrirStagesTitle": "Les étapes",
  "decouvrirStageActiveAria": "Étape actuelle",
  "decouvrirStageOpenAria": "Voir le guide de cette étape",
  "decouvrirSuggestionsTitle": "Suggestions du jour",
  "decouvrirSuggestionReasonAllergen": "Priorité allergène",
  "decouvrirSuggestionReasonDiversify": "Diversifie ta journée",
  "decouvrirSuggestionReasonRecent": "Pas essayé depuis 2 semaines",
  "decouvrirTipsTitle": "Astuce du jour",
  "decouvrirTipDismiss": "Masquer",
  "decouvrirSourcesTitle": "Sources scientifiques",

  "profilChildrenTitle": "Vos enfants",
  "profilChildrenAdd": "Ajouter un enfant",
  "profilChildrenChevronAria": "Ouvrir les réglages de {name}",
  "profilCoparentsTitle": "Co-parents",
  "profilCoparentsInvite": "Inviter un co-parent",
  "profilCoparentsEmpty": "Aucun co-parent invité pour l'instant.",
  "profilCompteTitle": "Compte",
  "profilComptePasskeys": "Clés d'accès",
  "profilComptePasskeysDevices": "{count, plural, one {# appareil} other {# appareils}}",
  "profilCompteLangue": "Langue",
  "profilCompteTheme": "Thème",
  "profilComptePassword": "Mot de passe",
  "profilRgpdTitle": "Vos données (RGPD)",
  "profilRgpdExport": "Exporter mes données",
  "profilRgpdDelete": "Supprimer mon compte",
  "profilLegalTitle": "Légal",

  "reactionHeroBody": "On vous accompagne. Notez ce que vous observez — vous pourrez tout exporter pour le pédiatre.",
  "reactionTitle": "Réaction · {food}",
  "reactionSubtitle": "{date} · {time} · {nth} exposition",
  "reactionRasMessage": "Aliment introduit · {nth} exposition · OK — rien à signaler.",
  "reactionSymptomsTitle": "Symptômes observés",
  "reactionSymptomsEmpty": "Aucun symptôme enregistré pour l'instant.",
  "reactionSymptomsAdd": "Ajouter un symptôme",
  "reactionStayCoolTitle": "Respirez",
  "reactionStayCoolBody": "Une réaction localisée se résout souvent seule. Surveillez 30 min.",
  "reactionStayCoolLink": "Voir le guide réactions",
  "reactionSevereRailBody": "Difficulté à respirer / lèvres bleues ? Appelez le 15 immédiatement.",
  "reactionTimerStart": "Suivre 30 min · activer un timer",
  "reactionTimerRunning": "Surveillance · {time} restantes",
  "reactionTimerDone": "30 min écoulées. Si tout va bien, vous pouvez fermer cette page.",
  "reactionExport": "Exporter pour le pédiatre",
  "reactionBackToCarnet": "Retour au carnet",

  "addSymptomTitle": "Quel symptôme ?",
  "addSymptomLabel": "Symptôme",
  "addSymptomNote": "Note (optionnelle)",
  "addSymptomNotePlaceholder": "Décrivez ce que vous observez (280 caractères max)…",
  "addSymptomObservedAt": "Observé à",
  "addSymptomSubmit": "Enregistrer le symptôme",

  "symptomsLabelRougeur": "Rougeur",
  "symptomsLabelUrticaire": "Urticaire",
  "symptomsLabelEczema": "Eczéma",
  "symptomsLabelVomissement": "Vomissement",
  "symptomsLabelDiarrhee": "Diarrhée",
  "symptomsLabelGonflement": "Gonflement",
  "symptomsLabelToux": "Toux",
  "symptomsLabelDetresseRespiratoire": "Détresse respiratoire",
  "symptomsLabelLevresBleues": "Lèvres bleues",
  "symptomsLabelAutre": "Autre",

  "printDocumentTitle": "Diversif · Journal de réaction",
  "printChildHeader": "{name}, {months} mois",
  "printFoodSection": "Aliment",
  "printSymptomsSection": "Symptômes observés",
  "printSeverityNeutral": "neutre",
  "printSeverityWarn": "à surveiller",
  "printSeveritySevere": "sévère",
  "printFooterNote": "Document à présenter au pédiatre",
  "printGeneratedAt": "Généré le {date}"
}
```

Run: `npm run paraglide` — Expected: compilation succeeds, regenerates `src/lib/paraglide/messages/`.

- [ ] **Step 2: Add EN keys**

In `messages/en.json`, mirror the same keys with English translations:

```json
{
  "decouvrirStagesTitle": "Stages",
  "decouvrirStageActiveAria": "Current stage",
  "decouvrirStageOpenAria": "Open this stage's guide",
  "decouvrirSuggestionsTitle": "Today's suggestions",
  "decouvrirSuggestionReasonAllergen": "Priority allergen",
  "decouvrirSuggestionReasonDiversify": "Adds variety today",
  "decouvrirSuggestionReasonRecent": "Not tried for 2 weeks",
  "decouvrirTipsTitle": "Tip of the day",
  "decouvrirTipDismiss": "Dismiss",
  "decouvrirSourcesTitle": "Scientific sources",

  "profilChildrenTitle": "Your children",
  "profilChildrenAdd": "Add a child",
  "profilChildrenChevronAria": "Open settings for {name}",
  "profilCoparentsTitle": "Co-parents",
  "profilCoparentsInvite": "Invite a co-parent",
  "profilCoparentsEmpty": "No co-parents invited yet.",
  "profilCompteTitle": "Account",
  "profilComptePasskeys": "Passkeys",
  "profilComptePasskeysDevices": "{count, plural, one {# device} other {# devices}}",
  "profilCompteLangue": "Language",
  "profilCompteTheme": "Theme",
  "profilComptePassword": "Password",
  "profilRgpdTitle": "Your data (GDPR)",
  "profilRgpdExport": "Export my data",
  "profilRgpdDelete": "Delete my account",
  "profilLegalTitle": "Legal",

  "reactionHeroBody": "We've got you. Log what you observe — you can export everything for the pediatrician.",
  "reactionTitle": "Reaction · {food}",
  "reactionSubtitle": "{date} · {time} · {nth} exposure",
  "reactionRasMessage": "Food introduced · {nth} exposure · OK — nothing to report.",
  "reactionSymptomsTitle": "Symptoms observed",
  "reactionSymptomsEmpty": "No symptoms logged yet.",
  "reactionSymptomsAdd": "Add a symptom",
  "reactionStayCoolTitle": "Take a breath",
  "reactionStayCoolBody": "A localized reaction often resolves on its own. Monitor for 30 min.",
  "reactionStayCoolLink": "See the reactions guide",
  "reactionSevereRailBody": "Trouble breathing / blue lips? Call emergency services immediately.",
  "reactionTimerStart": "Monitor 30 min · start a timer",
  "reactionTimerRunning": "Monitoring · {time} remaining",
  "reactionTimerDone": "30 minutes elapsed. If all is well, you can close this page.",
  "reactionExport": "Export for the pediatrician",
  "reactionBackToCarnet": "Back to the notebook",

  "addSymptomTitle": "Which symptom?",
  "addSymptomLabel": "Symptom",
  "addSymptomNote": "Note (optional)",
  "addSymptomNotePlaceholder": "Describe what you observe (280 chars max)…",
  "addSymptomObservedAt": "Observed at",
  "addSymptomSubmit": "Log the symptom",

  "symptomsLabelRougeur": "Redness",
  "symptomsLabelUrticaire": "Hives",
  "symptomsLabelEczema": "Eczema",
  "symptomsLabelVomissement": "Vomiting",
  "symptomsLabelDiarrhee": "Diarrhea",
  "symptomsLabelGonflement": "Swelling",
  "symptomsLabelToux": "Cough",
  "symptomsLabelDetresseRespiratoire": "Breathing distress",
  "symptomsLabelLevresBleues": "Blue lips",
  "symptomsLabelAutre": "Other",

  "printDocumentTitle": "Diversif · Reaction Journal",
  "printChildHeader": "{name}, {months} months",
  "printFoodSection": "Food",
  "printSymptomsSection": "Symptoms observed",
  "printSeverityNeutral": "neutral",
  "printSeverityWarn": "watch",
  "printSeveritySevere": "severe",
  "printFooterNote": "Document to present to the pediatrician",
  "printGeneratedAt": "Generated on {date}"
}
```

Run: `npm run paraglide` — Expected: compilation succeeds.

- [ ] **Step 3: Commit**

```bash
git add messages/fr.json messages/en.json
git commit -m "feat(i18n): paraglide keys for Phase 5 surfaces"
```

---

### Task 4: chooseSuggestedFoods (plural, top-N)

**Files:**

- Modify: `src/lib/utils/suggest.ts`
- Modify: `src/lib/utils/suggest.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/utils/suggest.test.ts`:

```ts
import { chooseSuggestedFoods } from './suggest';

describe('chooseSuggestedFoods (plural)', () => {
  const starter = [
    { id: 1, name: 'Poire', category: 'fruits', isPriorityAllergen: false },
    { id: 2, name: 'Carotte', category: 'legumes', isPriorityAllergen: false },
    { id: 3, name: 'Œuf', category: 'oeufs', isPriorityAllergen: true },
    { id: 4, name: 'Pomme', category: 'fruits', isPriorityAllergen: false },
    { id: 5, name: 'Bœuf', category: 'proteines', isPriorityAllergen: false },
    { id: 6, name: 'Riz', category: 'feculents', isPriorityAllergen: false }
  ];

  it('returns up to N suggestions', () => {
    const out = chooseSuggestedFoods({
      starterFoods: starter,
      recent: [],
      priorityAllergensTodo: [],
      now: Date.parse('2026-05-01T12:00:00Z'),
      count: 5
    });
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out.length).toBeGreaterThan(0);
  });

  it('annotates each suggestion with a reason key', () => {
    const out = chooseSuggestedFoods({
      starterFoods: starter,
      recent: [],
      priorityAllergensTodo: [{ id: 3, name: 'Œuf', category: 'oeufs', isPriorityAllergen: true }],
      now: Date.parse('2026-05-01T12:00:00Z'),
      count: 3
    });
    for (const s of out) {
      expect(['allergen', 'diversify', 'recent']).toContain(s.reason);
    }
    expect(out.some((s) => s.reason === 'allergen' && s.food.id === 3)).toBe(true);
  });

  it('does not repeat foods', () => {
    const out = chooseSuggestedFoods({
      starterFoods: starter,
      recent: [],
      priorityAllergensTodo: [],
      now: Date.parse('2026-05-01T12:00:00Z'),
      count: 5
    });
    const ids = out.map((s) => s.food.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/suggest.test.ts`
Expected: FAIL — `chooseSuggestedFoods is not a function`.

- [ ] **Step 3: Implement**

Append to `src/lib/utils/suggest.ts` (after the existing `chooseSuggestedFood`):

```ts
export type SuggestionReason = 'allergen' | 'diversify' | 'recent';

export type RankedSuggestion = {
  food: SuggestFood;
  reason: SuggestionReason;
};

export function chooseSuggestedFoods(args: {
  starterFoods: SuggestFood[];
  recent: { foodId: number; foodName: string; category: string; givenAt: number }[];
  priorityAllergensTodo: SuggestFood[];
  now: number;
  count: number;
}): RankedSuggestion[] {
  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
  const out: RankedSuggestion[] = [];
  const seen = new Set<number>();

  for (const allergen of args.priorityAllergensTodo) {
    if (out.length >= args.count) break;
    if (seen.has(allergen.id)) continue;
    out.push({ food: allergen, reason: 'allergen' });
    seen.add(allergen.id);
  }

  const recentCategories = new Set(args.recent.slice(0, 5).map((r) => r.category));
  const recentFoodIds = new Set(args.recent.map((r) => r.foodId));

  for (const food of args.starterFoods) {
    if (out.length >= args.count) break;
    if (seen.has(food.id)) continue;
    if (recentFoodIds.has(food.id)) continue;
    if (!recentCategories.has(food.category)) {
      out.push({ food, reason: 'diversify' });
      seen.add(food.id);
    }
  }

  for (const food of args.starterFoods) {
    if (out.length >= args.count) break;
    if (seen.has(food.id)) continue;
    const lastEaten = args.recent.find((r) => r.foodId === food.id);
    if (lastEaten && args.now - lastEaten.givenAt > TWO_WEEKS_MS) {
      out.push({ food, reason: 'recent' });
      seen.add(food.id);
    }
  }

  for (const food of args.starterFoods) {
    if (out.length >= args.count) break;
    if (seen.has(food.id)) continue;
    out.push({ food, reason: 'diversify' });
    seen.add(food.id);
  }

  return out;
}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/utils/suggest.test.ts`
Expected: PASS

```bash
git add src/lib/utils/suggest.ts src/lib/utils/suggest.test.ts
git commit -m "feat(suggest): chooseSuggestedFoods returns ranked top-N with reasons"
```

---

### Task 5: StagesBentoGrid component

**Files:**

- Create: `src/lib/components/bento/StagesBentoGrid.svelte`
- Create: `src/lib/components/bento/StagesBentoGrid.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/StagesBentoGrid.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import StagesBentoGrid from './StagesBentoGrid.svelte';

afterEach(() => cleanup());

describe('StagesBentoGrid', () => {
  const stages = [
    { id: '4-6m', title: '4 à 6 mois', oneLiner: 'Démarrer en douceur' },
    { id: '6-9m', title: '6 à 9 mois', oneLiner: 'Diversifier le panier' },
    { id: '9-12m', title: '9 à 12 mois', oneLiner: 'Vers la cuillère' },
    { id: '12m+', title: '12 mois et plus', oneLiner: 'Vers la table familiale' }
  ];

  it('renders four stage tiles with titles', () => {
    render(StagesBentoGrid, { props: { stages, activeStageId: '6-9m', onOpen: () => {} } });
    expect(screen.getByText('4 à 6 mois')).toBeTruthy();
    expect(screen.getByText('6 à 9 mois')).toBeTruthy();
    expect(screen.getByText('9 à 12 mois')).toBeTruthy();
    expect(screen.getByText('12 mois et plus')).toBeTruthy();
  });

  it('marks the active stage with aria-current="step"', () => {
    render(StagesBentoGrid, { props: { stages, activeStageId: '6-9m', onOpen: () => {} } });
    const active = screen.getByText('6 à 9 mois').closest('button');
    expect(active?.getAttribute('aria-current')).toBe('step');
  });

  it('calls onOpen with the stage id when a tile is tapped', async () => {
    const onOpen = vi.fn();
    render(StagesBentoGrid, { props: { stages, activeStageId: '6-9m', onOpen } });
    await fireEvent.click(screen.getByText('9 à 12 mois'));
    expect(onOpen).toHaveBeenCalledWith('9-12m');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/StagesBentoGrid.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/StagesBentoGrid.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  type Stage = { id: string; title: string; oneLiner: string };

  let {
    stages,
    activeStageId,
    onOpen
  }: { stages: Stage[]; activeStageId: string; onOpen: (id: string) => void } = $props();
</script>

<section class="mb-3" aria-label={m.decouvrirStagesTitle()}>
  <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
    {m.decouvrirStagesTitle()}
  </h2>
  <div class="grid grid-cols-2 gap-3">
    {#each stages as stage (stage.id)}
      {@const active = stage.id === activeStageId}
      <button
        type="button"
        onclick={() => onOpen(stage.id)}
        aria-current={active ? 'step' : undefined}
        aria-label={active ? m.decouvrirStageActiveAria() : m.decouvrirStageOpenAria()}
        class={cn(
          'rounded-tile bg-tile-lilac p-4 text-left shadow-soft transition-transform duration-base ease-soft hover:scale-[1.01] active:scale-[0.99]',
          active && 'ring-2 ring-primary'
        )}
      >
        <p class="font-display text-lg italic leading-tight">{stage.title}</p>
        <p class="mt-1 text-xs text-ink-soft">{stage.oneLiner}</p>
      </button>
    {/each}
  </div>
</section>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/StagesBentoGrid.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/StagesBentoGrid.svelte src/lib/components/bento/StagesBentoGrid.test.ts
git commit -m "feat(bento): StagesBentoGrid — 2x2 stages tiles with active glow"
```

---

### Task 6: StageDetailSheet component

**Files:**

- Create: `src/lib/components/bento/StageDetailSheet.svelte`
- Create: `src/lib/components/bento/StageDetailSheet.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/StageDetailSheet.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import StageDetailSheet from './StageDetailSheet.svelte';

afterEach(() => cleanup());

describe('StageDetailSheet', () => {
  const stage = {
    id: '6-9m',
    title: '6 à 9 mois',
    oneLiner: 'Diversifier le panier',
    principles: ['Mixé puis écrasé', 'Une nouvelle saveur à la fois'],
    focus: ['Légumes verts', 'Fruits cuits', 'Céréales infantiles'],
    textures: 'Purées lisses puis écrasées',
    milkTarget: '600 à 800 ml de lait par jour',
    redFlags: ['Refus persistant > 1 semaine'],
    sources: ['ANSES-2019', 'ESPGHAN-2017']
  };

  it('renders nothing when open=false', () => {
    const { container } = render(StageDetailSheet, {
      props: { open: false, stage, onClose: () => {} }
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the stage title and principles when open', () => {
    render(StageDetailSheet, { props: { open: true, stage, onClose: () => {} } });
    expect(screen.getByText('6 à 9 mois')).toBeTruthy();
    expect(screen.getByText('Mixé puis écrasé')).toBeTruthy();
  });

  it('renders focus foods, textures, and milk target', () => {
    render(StageDetailSheet, { props: { open: true, stage, onClose: () => {} } });
    expect(screen.getByText('Légumes verts')).toBeTruthy();
    expect(screen.getByText('Purées lisses puis écrasées')).toBeTruthy();
    expect(screen.getByText(/600 à 800 ml/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/StageDetailSheet.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/StageDetailSheet.svelte`:

```svelte
<script lang="ts">
  import { Sheet } from 'bits-ui';

  type Stage = {
    id: string;
    title: string;
    oneLiner: string;
    principles: string[];
    focus: string[];
    textures: string;
    milkTarget: string;
    redFlags: string[];
    sources: string[];
  };

  let { open, stage, onClose }: { open: boolean; stage: Stage; onClose: () => void } = $props();
</script>

<Sheet.Root bind:open={
    () => open,
    (v) => {
      if (!v) onClose();
    }
  }>
  <Sheet.Portal>
    <Sheet.Overlay class="fixed inset-0 z-40 bg-ink/40" />
    <Sheet.Content
      side="bottom"
      class="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-hero bg-surface px-4 py-5 shadow-lifted"
    >
      <div class="mx-auto mb-3 h-1 w-12 rounded-full bg-border" aria-hidden="true"></div>
      <Sheet.Title class="font-display text-2xl italic leading-tight">{stage.title}</Sheet.Title>
      <p class="mt-1 text-sm text-ink-soft">{stage.oneLiner}</p>

      <section class="mt-4">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Principes</h3>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
          {#each stage.principles as p, i (i)}
            <li>{p}</li>
          {/each}
        </ul>
      </section>

      <section class="mt-4">
        <h3 class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Aliments à proposer</h3>
        <ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
          {#each stage.focus as f, i (i)}
            <li>{f}</li>
          {/each}
        </ul>
      </section>

      <section class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="rounded-tile bg-tile-mint/40 p-3 text-sm">
          <p class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Texture</p>
          <p class="mt-1">{stage.textures}</p>
        </div>
        <div class="rounded-tile bg-tile-butter/40 p-3 text-sm">
          <p class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Lait</p>
          <p class="mt-1">{stage.milkTarget}</p>
        </div>
      </section>

      {#if stage.redFlags.length > 0}
        <section class="mt-4 rounded-tile border border-warning bg-tile-butter/30 p-3 text-sm">
          <p class="text-xs font-semibold uppercase tracking-wider text-warning-foreground">À surveiller</p>
          <ul class="mt-1 list-disc space-y-1 pl-5">
            {#each stage.redFlags as f, i (i)}
              <li>{f}</li>
            {/each}
          </ul>
        </section>
      {/if}
    </Sheet.Content>
  </Sheet.Portal>
</Sheet.Root>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/StageDetailSheet.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/StageDetailSheet.svelte src/lib/components/bento/StageDetailSheet.test.ts
git commit -m "feat(bento): StageDetailSheet — bits-ui Sheet for stage content"
```

---

### Task 7: SuggestionFeed component

**Files:**

- Create: `src/lib/components/bento/SuggestionFeed.svelte`
- Create: `src/lib/components/bento/SuggestionFeed.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/SuggestionFeed.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import SuggestionFeed from './SuggestionFeed.svelte';

afterEach(() => cleanup());

describe('SuggestionFeed', () => {
  const suggestions = [
    {
      food: { id: 1, name: 'Poire', category: 'fruits', isPriorityAllergen: false },
      reason: 'diversify' as const
    },
    {
      food: { id: 2, name: 'Œuf', category: 'oeufs', isPriorityAllergen: true },
      reason: 'allergen' as const
    },
    {
      food: { id: 3, name: 'Carotte', category: 'legumes', isPriorityAllergen: false },
      reason: 'recent' as const
    }
  ];

  it('renders one card per suggestion', () => {
    render(SuggestionFeed, { props: { suggestions, onPick: () => {} } });
    expect(screen.getByText('Poire')).toBeTruthy();
    expect(screen.getByText('Œuf')).toBeTruthy();
    expect(screen.getByText('Carotte')).toBeTruthy();
  });

  it('renders the reason chip for each suggestion', () => {
    render(SuggestionFeed, { props: { suggestions, onPick: () => {} } });
    expect(screen.getByText('Priorité allergène')).toBeTruthy();
    expect(screen.getByText('Diversifie ta journée')).toBeTruthy();
    expect(screen.getByText('Pas essayé depuis 2 semaines')).toBeTruthy();
  });

  it('calls onPick with the food when a card is tapped', async () => {
    const onPick = vi.fn();
    render(SuggestionFeed, { props: { suggestions, onPick } });
    await fireEvent.click(screen.getByText('Poire'));
    expect(onPick).toHaveBeenCalledWith(suggestions[0].food);
  });

  it('renders nothing when suggestions is empty', () => {
    const { container } = render(SuggestionFeed, { props: { suggestions: [], onPick: () => {} } });
    expect(container.querySelector('section')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/SuggestionFeed.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/SuggestionFeed.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { SuggestFood } from '$lib/utils/suggest';

  type Suggestion = { food: SuggestFood; reason: 'allergen' | 'diversify' | 'recent' };

  let {
    suggestions,
    onPick
  }: { suggestions: Suggestion[]; onPick: (food: SuggestFood) => void } = $props();

  function reasonLabel(r: Suggestion['reason']): string {
    if (r === 'allergen') return m.decouvrirSuggestionReasonAllergen();
    if (r === 'recent') return m.decouvrirSuggestionReasonRecent();
    return m.decouvrirSuggestionReasonDiversify();
  }
</script>

{#if suggestions.length > 0}
  <section class="mb-3" aria-label={m.decouvrirSuggestionsTitle()}>
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
      {m.decouvrirSuggestionsTitle()}
    </h2>
    <ul class="flex flex-col gap-2">
      {#each suggestions as s (s.food.id)}
        <li>
          <button
            type="button"
            onclick={() => onPick(s.food)}
            class="flex w-full items-center justify-between rounded-tile bg-tile-lilac px-4 py-3 text-left shadow-soft transition-transform duration-base ease-soft hover:scale-[1.01] active:scale-[0.99]"
          >
            <span class="font-bold">{s.food.name}</span>
            <span class="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink-soft">
              {reasonLabel(s.reason)}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/SuggestionFeed.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/SuggestionFeed.svelte src/lib/components/bento/SuggestionFeed.test.ts
git commit -m "feat(bento): SuggestionFeed — vertical lilac feed with reason chips"
```

---

### Task 8: TipsRotator component

**Files:**

- Create: `src/lib/components/bento/TipsRotator.svelte`
- Create: `src/lib/components/bento/TipsRotator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/TipsRotator.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import TipsRotator from './TipsRotator.svelte';

afterEach(() => cleanup());

describe('TipsRotator', () => {
  const tip = {
    id: 'tip-allergen-eggs',
    title: "Introduire l'œuf tôt",
    body: "Selon LEAP, introduire l'œuf entre 4 et 11 mois réduit le risque d'allergie."
  };

  it('renders the tip title and body when not dismissed', () => {
    render(TipsRotator, { props: { tip, dismissed: false, onDismiss: () => {} } });
    expect(screen.getByText("Introduire l'œuf tôt")).toBeTruthy();
    expect(screen.getByText(/LEAP/)).toBeTruthy();
  });

  it('renders nothing when dismissed=true', () => {
    const { container } = render(TipsRotator, {
      props: { tip, dismissed: true, onDismiss: () => {} }
    });
    expect(container.querySelector('section')).toBeNull();
  });

  it('renders nothing when tip is null', () => {
    const { container } = render(TipsRotator, {
      props: { tip: null, dismissed: false, onDismiss: () => {} }
    });
    expect(container.querySelector('section')).toBeNull();
  });

  it('calls onDismiss with the tip id when dismiss is tapped', async () => {
    const onDismiss = vi.fn();
    render(TipsRotator, { props: { tip, dismissed: false, onDismiss } });
    await fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
    expect(onDismiss).toHaveBeenCalledWith('tip-allergen-eggs');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/TipsRotator.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/TipsRotator.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  type Tip = { id: string; title: string; body: string };

  let {
    tip,
    dismissed,
    onDismiss
  }: { tip: Tip | null; dismissed: boolean; onDismiss: (id: string) => void } = $props();
</script>

{#if tip && !dismissed}
  <section class="mb-3" aria-label={m.decouvrirTipsTitle()}>
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
      {m.decouvrirTipsTitle()}
    </h2>
    <article class="rounded-tile bg-tile-butter p-4 shadow-soft">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1">
          <p class="text-base font-bold leading-tight">{tip.title}</p>
          <p class="mt-1 text-sm text-ink-soft">{tip.body}</p>
        </div>
        <button
          type="button"
          onclick={() => onDismiss(tip.id)}
          class="rounded-full bg-surface px-2 py-1 text-xs font-semibold text-ink-soft transition-transform duration-fast ease-soft active:scale-[0.97]"
        >
          {m.decouvrirTipDismiss()}
        </button>
      </div>
    </article>
  </section>
{/if}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/TipsRotator.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/TipsRotator.svelte src/lib/components/bento/TipsRotator.test.ts
git commit -m "feat(bento): TipsRotator — daily butter TipCard, dismissible"
```

---

### Task 9: SourcesCluster component

**Files:**

- Create: `src/lib/components/bento/SourcesCluster.svelte`
- Create: `src/lib/components/bento/SourcesCluster.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/SourcesCluster.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import SourcesCluster from './SourcesCluster.svelte';

afterEach(() => cleanup());

describe('SourcesCluster', () => {
  it('renders the five canonical sources', () => {
    render(SourcesCluster, {});
    expect(screen.getByText('LEAP')).toBeTruthy();
    expect(screen.getByText('EAT')).toBeTruthy();
    expect(screen.getByText('ESPGHAN')).toBeTruthy();
    expect(screen.getByText('ANSES')).toBeTruthy();
    expect(screen.getByText('HCSP')).toBeTruthy();
  });

  it('each source links into /sources with an anchor', () => {
    render(SourcesCluster, {});
    expect(screen.getByText('LEAP').closest('a')?.getAttribute('href')).toBe('/sources#leap');
    expect(screen.getByText('ANSES').closest('a')?.getAttribute('href')).toBe('/sources#anses');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/SourcesCluster.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/SourcesCluster.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  const SOURCES = [
    { key: 'leap', label: 'LEAP' },
    { key: 'eat', label: 'EAT' },
    { key: 'espghan', label: 'ESPGHAN' },
    { key: 'anses', label: 'ANSES' },
    { key: 'hcsp', label: 'HCSP' }
  ] as const;
</script>

<section class="mb-3" aria-label={m.decouvrirSourcesTitle()}>
  <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
    {m.decouvrirSourcesTitle()}
  </h2>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
    {#each SOURCES as src (src.key)}
      <a
        href={`/sources#${src.key}`}
        class="rounded-tile bg-tile-sky px-3 py-2 text-center text-sm font-semibold text-tile-sky-foreground shadow-soft transition-transform duration-base ease-soft hover:scale-[1.02] active:scale-[0.99]"
      >
        {src.label}
      </a>
    {/each}
  </div>
</section>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/SourcesCluster.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/SourcesCluster.svelte src/lib/components/bento/SourcesCluster.test.ts
git commit -m "feat(bento): SourcesCluster — 5 sky tiles for scientific sources"
```

---

### Task 10: DiscoverBento composer

**Files:**

- Create: `src/lib/components/bento/DiscoverBento.svelte`
- Create: `src/lib/components/bento/DiscoverBento.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/DiscoverBento.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import DiscoverBento from './DiscoverBento.svelte';

afterEach(() => cleanup());

describe('DiscoverBento', () => {
  const baseProps = {
    stages: [
      {
        id: '4-6m',
        title: '4 à 6 mois',
        oneLiner: 'Démarrer en douceur',
        principles: [],
        focus: [],
        textures: '',
        milkTarget: '',
        redFlags: [],
        sources: []
      },
      {
        id: '6-9m',
        title: '6 à 9 mois',
        oneLiner: 'Diversifier',
        principles: [],
        focus: [],
        textures: '',
        milkTarget: '',
        redFlags: [],
        sources: []
      },
      {
        id: '9-12m',
        title: '9 à 12 mois',
        oneLiner: 'Cuillère',
        principles: [],
        focus: [],
        textures: '',
        milkTarget: '',
        redFlags: [],
        sources: []
      },
      {
        id: '12m+',
        title: '12 mois et plus',
        oneLiner: 'Famille',
        principles: [],
        focus: [],
        textures: '',
        milkTarget: '',
        redFlags: [],
        sources: []
      }
    ],
    activeStageId: '6-9m',
    suggestions: [
      {
        food: { id: 1, name: 'Poire', category: 'fruits', isPriorityAllergen: false },
        reason: 'diversify' as const
      }
    ],
    todayTip: { id: 'tip-1', title: 'Astuce', body: 'Quelque chose' },
    tipDismissed: false,
    onPickSuggestion: vi.fn(),
    onDismissTip: vi.fn()
  };

  it('renders all four sections', () => {
    render(DiscoverBento, { props: baseProps });
    expect(screen.getByText('Les étapes')).toBeTruthy();
    expect(screen.getByText('Suggestions du jour')).toBeTruthy();
    expect(screen.getByText('Astuce du jour')).toBeTruthy();
    expect(screen.getByText('Sources scientifiques')).toBeTruthy();
  });

  it('tapping a stage tile opens the StageDetailSheet', async () => {
    render(DiscoverBento, { props: baseProps });
    await fireEvent.click(screen.getByText('9 à 12 mois'));
    expect(screen.getByText('9 à 12 mois', { selector: 'h2' })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/DiscoverBento.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/DiscoverBento.svelte`:

```svelte
<script lang="ts">
  import StagesBentoGrid from './StagesBentoGrid.svelte';
  import StageDetailSheet from './StageDetailSheet.svelte';
  import SuggestionFeed from './SuggestionFeed.svelte';
  import TipsRotator from './TipsRotator.svelte';
  import SourcesCluster from './SourcesCluster.svelte';
  import type { SuggestFood } from '$lib/utils/suggest';

  type Stage = {
    id: string;
    title: string;
    oneLiner: string;
    principles: string[];
    focus: string[];
    textures: string;
    milkTarget: string;
    redFlags: string[];
    sources: string[];
  };

  let {
    stages,
    activeStageId,
    suggestions,
    todayTip,
    tipDismissed,
    onPickSuggestion,
    onDismissTip
  }: {
    stages: Stage[];
    activeStageId: string;
    suggestions: { food: SuggestFood; reason: 'allergen' | 'diversify' | 'recent' }[];
    todayTip: { id: string; title: string; body: string } | null;
    tipDismissed: boolean;
    onPickSuggestion: (food: SuggestFood) => void;
    onDismissTip: (id: string) => void;
  } = $props();

  let openStageId = $state<string | null>(null);
  const openStage = $derived(openStageId ? stages.find((s) => s.id === openStageId) ?? null : null);
</script>

<div class="flex flex-col">
  <StagesBentoGrid {stages} {activeStageId} onOpen={(id) => (openStageId = id)} />
  <SuggestionFeed {suggestions} onPick={onPickSuggestion} />
  <TipsRotator tip={todayTip} dismissed={tipDismissed} onDismiss={onDismissTip} />
  <SourcesCluster />
</div>

{#if openStage}
  <StageDetailSheet open={openStageId !== null} stage={openStage} onClose={() => (openStageId = null)} />
{/if}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/DiscoverBento.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/DiscoverBento.svelte src/lib/components/bento/DiscoverBento.test.ts
git commit -m "feat(bento): DiscoverBento — composes stages, suggestions, tips, sources"
```

---

### Task 11: ChildCardRow component

**Files:**

- Create: `src/lib/components/bento/ChildCardRow.svelte`
- Create: `src/lib/components/bento/ChildCardRow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/ChildCardRow.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ChildCardRow from './ChildCardRow.svelte';

afterEach(() => cleanup());

describe('ChildCardRow', () => {
  it('renders the child name and age', () => {
    render(ChildCardRow, {
      props: { child: { id: 'abc', name: 'Léo', ageMonths: 7 }, href: '/child/abc/settings' }
    });
    expect(screen.getByText('Léo')).toBeTruthy();
    expect(screen.getByText('7 mois')).toBeTruthy();
  });

  it('links to the settings href', () => {
    render(ChildCardRow, {
      props: { child: { id: 'abc', name: 'Léo', ageMonths: 7 }, href: '/child/abc/settings' }
    });
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/child/abc/settings');
  });

  it('renders an aria-label that names the child', () => {
    render(ChildCardRow, {
      props: { child: { id: 'abc', name: 'Léo', ageMonths: 7 }, href: '/child/abc/settings' }
    });
    expect(screen.getByLabelText('Ouvrir les réglages de Léo')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/ChildCardRow.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/ChildCardRow.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { ChevronRight } from 'lucide-svelte';

  type Child = { id: string; name: string; ageMonths: number };

  let { child, href }: { child: Child; href: string } = $props();
</script>

<a
  {href}
  aria-label={m.profilChildrenChevronAria({ name: child.name })}
  class="mb-2 flex items-center gap-3 rounded-tile bg-tile-peach px-4 py-3 shadow-soft transition-transform duration-base ease-soft hover:scale-[1.01] active:scale-[0.99]"
>
  <span class="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-base font-bold">
    {child.name.charAt(0)}
  </span>
  <span class="flex-1">
    <p class="text-base font-bold leading-tight">{child.name}</p>
    <p class="text-xs text-ink-soft">{child.ageMonths} mois</p>
  </span>
  <ChevronRight size={18} class="text-ink-soft" aria-hidden="true" />
</a>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/ChildCardRow.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/ChildCardRow.svelte src/lib/components/bento/ChildCardRow.test.ts
git commit -m "feat(bento): ChildCardRow — avatar + name + age + chevron"
```

---

### Task 12: CoparentsSection component

**Files:**

- Create: `src/lib/components/bento/CoparentsSection.svelte`
- Create: `src/lib/components/bento/CoparentsSection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/CoparentsSection.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import CoparentsSection from './CoparentsSection.svelte';

afterEach(() => cleanup());

describe('CoparentsSection', () => {
  it('renders an entry per coparent', () => {
    render(CoparentsSection, {
      props: {
        childName: 'Léo',
        coparents: [
          { id: '1', displayName: 'Alice', role: 'co-parent' },
          { id: '2', displayName: 'Bob', role: 'caregiver' }
        ],
        inviteHref: '/child/abc/settings#invite'
      }
    });
    expect(screen.getByText('Alice')).toBeTruthy();
    expect(screen.getByText('Bob')).toBeTruthy();
  });

  it('shows the empty message when no coparents are present', () => {
    render(CoparentsSection, {
      props: { childName: 'Léo', coparents: [], inviteHref: '/child/abc/settings#invite' }
    });
    expect(screen.getByText("Aucun co-parent invité pour l'instant.")).toBeTruthy();
  });

  it('always renders the invite link', () => {
    render(CoparentsSection, {
      props: { childName: 'Léo', coparents: [], inviteHref: '/child/abc/settings#invite' }
    });
    const invite = screen.getByText('Inviter un co-parent').closest('a');
    expect(invite?.getAttribute('href')).toBe('/child/abc/settings#invite');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/CoparentsSection.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/CoparentsSection.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { UserPlus } from 'lucide-svelte';

  type Coparent = { id: string; displayName: string; role: string };

  let {
    childName,
    coparents,
    inviteHref
  }: { childName: string; coparents: Coparent[]; inviteHref: string } = $props();
</script>

<section class="mb-3" aria-label={`${m.profilCoparentsTitle()} — ${childName}`}>
  <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
    {m.profilCoparentsTitle()} · {childName}
  </h2>
  {#if coparents.length === 0}
    <p class="rounded-tile border border-dashed border-border bg-canvas p-3 text-center text-sm text-ink-soft">
      {m.profilCoparentsEmpty()}
    </p>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each coparents as cp (cp.id)}
        <li class="flex items-center gap-3 rounded-tile bg-surface px-3 py-2 shadow-soft">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-tile-lilac text-xs font-bold">
            {cp.displayName.charAt(0)}
          </span>
          <span class="flex-1 text-sm font-bold">{cp.displayName}</span>
          <span class="text-xs text-ink-soft">{cp.role}</span>
        </li>
      {/each}
    </ul>
  {/if}
  <a
    href={inviteHref}
    class="mt-2 flex items-center gap-2 rounded-tile border border-dashed border-border bg-canvas px-3 py-2 text-sm font-semibold text-ink-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    <UserPlus size={16} aria-hidden="true" />
    {m.profilCoparentsInvite()}
  </a>
</section>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/CoparentsSection.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/CoparentsSection.svelte src/lib/components/bento/CoparentsSection.test.ts
git commit -m "feat(bento): CoparentsSection — per-child memberships + invite row"
```

---

### Task 13: CompteSection component

**Files:**

- Create: `src/lib/components/bento/CompteSection.svelte`
- Create: `src/lib/components/bento/CompteSection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/CompteSection.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import CompteSection from './CompteSection.svelte';

afterEach(() => cleanup());

describe('CompteSection', () => {
  const baseProps = {
    passkeyCount: 2,
    locale: 'fr' as const,
    theme: 'system' as const
  };

  it('renders the four rows', () => {
    render(CompteSection, { props: baseProps });
    expect(screen.getByText("Clés d'accès")).toBeTruthy();
    expect(screen.getByText('Langue')).toBeTruthy();
    expect(screen.getByText('Thème')).toBeTruthy();
    expect(screen.getByText('Mot de passe')).toBeTruthy();
  });

  it('renders the passkey device count', () => {
    render(CompteSection, { props: baseProps });
    expect(screen.getByText('2 appareils')).toBeTruthy();
  });

  it('renders 1 device in singular form', () => {
    render(CompteSection, { props: { ...baseProps, passkeyCount: 1 } });
    expect(screen.getByText('1 appareil')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/CompteSection.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/CompteSection.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { ChevronRight, KeyRound, Languages, Moon, Lock } from 'lucide-svelte';

  let {
    passkeyCount,
    locale,
    theme
  }: { passkeyCount: number; locale: 'fr' | 'en'; theme: 'system' | 'light' | 'dark' } = $props();

  const rows = $derived([
    {
      key: 'passkeys',
      icon: KeyRound,
      label: m.profilComptePasskeys(),
      meta: m.profilComptePasskeysDevices({ count: String(passkeyCount) }),
      href: '/account#passkeys'
    },
    { key: 'langue', icon: Languages, label: m.profilCompteLangue(), meta: locale.toUpperCase(), href: '/account#locale' },
    { key: 'theme', icon: Moon, label: m.profilCompteTheme(), meta: theme, href: '/account#theme' },
    {
      key: 'password',
      icon: Lock,
      label: m.profilComptePassword(),
      meta: '',
      href: '/account#password'
    }
  ]);
</script>

<section class="mb-3" aria-label={m.profilCompteTitle()}>
  <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
    {m.profilCompteTitle()}
  </h2>
  <ul class="flex flex-col gap-2">
    {#each rows as row (row.key)}
      <li>
        <a
          href={row.href}
          class="flex items-center gap-3 rounded-tile bg-surface px-3 py-3 shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
        >
          <row.icon size={18} class="text-ink-soft" aria-hidden="true" />
          <span class="flex-1 text-sm font-bold">{row.label}</span>
          {#if row.meta}
            <span class="text-xs text-ink-soft">{row.meta}</span>
          {/if}
          <ChevronRight size={16} class="text-ink-soft" aria-hidden="true" />
        </a>
      </li>
    {/each}
  </ul>
</section>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/CompteSection.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/CompteSection.svelte src/lib/components/bento/CompteSection.test.ts
git commit -m "feat(bento): CompteSection — Passkeys, Langue, Thème, Mot de passe rows"
```

---

### Task 14: RgpdSection component

**Files:**

- Create: `src/lib/components/bento/RgpdSection.svelte`
- Create: `src/lib/components/bento/RgpdSection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/RgpdSection.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import RgpdSection from './RgpdSection.svelte';

afterEach(() => cleanup());

describe('RgpdSection', () => {
  it('renders the export row linking to /account/export', () => {
    render(RgpdSection, {});
    const exp = screen.getByText('Exporter mes données').closest('a');
    expect(exp?.getAttribute('href')).toBe('/account/export');
  });

  it('renders the delete row linking to /account#delete', () => {
    render(RgpdSection, {});
    const del = screen.getByText('Supprimer mon compte').closest('a');
    expect(del?.getAttribute('href')).toBe('/account#delete');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/RgpdSection.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/RgpdSection.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { Download, Trash2 } from 'lucide-svelte';
</script>

<section class="mb-3" aria-label={m.profilRgpdTitle()}>
  <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
    {m.profilRgpdTitle()}
  </h2>
  <a
    href="/account/export"
    class="mb-2 flex items-center gap-3 rounded-tile bg-tile-peach px-3 py-3 shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    <Download size={18} class="text-tile-peach-foreground" aria-hidden="true" />
    <span class="flex-1 text-sm font-bold">{m.profilRgpdExport()}</span>
  </a>
  <a
    href="/account#delete"
    class="flex items-center gap-3 rounded-tile bg-tile-butter px-3 py-3 shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    <Trash2 size={18} class="text-tile-butter-foreground" aria-hidden="true" />
    <span class="flex-1 text-sm font-bold">{m.profilRgpdDelete()}</span>
  </a>
</section>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/RgpdSection.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/RgpdSection.svelte src/lib/components/bento/RgpdSection.test.ts
git commit -m "feat(bento): RgpdSection — peach export + butter delete rows"
```

---

### Task 15: ProfilBento composer

**Files:**

- Create: `src/lib/components/bento/ProfilBento.svelte`
- Create: `src/lib/components/bento/ProfilBento.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/ProfilBento.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ProfilBento from './ProfilBento.svelte';

afterEach(() => cleanup());

describe('ProfilBento', () => {
  const baseProps = {
    children: [
      {
        id: 'a',
        name: 'Léo',
        ageMonths: 7,
        coparents: [{ id: '1', displayName: 'Alice', role: 'co-parent' }]
      }
    ],
    passkeyCount: 2,
    locale: 'fr' as const,
    theme: 'system' as const
  };

  it('renders all sections', () => {
    render(ProfilBento, { props: baseProps });
    expect(screen.getByText('Vos enfants')).toBeTruthy();
    expect(screen.getByText(/Co-parents/)).toBeTruthy();
    expect(screen.getByText('Compte')).toBeTruthy();
    expect(screen.getByText('Vos données (RGPD)')).toBeTruthy();
    expect(screen.getByText('Légal')).toBeTruthy();
  });

  it('renders the add-child row even with no children', () => {
    render(ProfilBento, {
      props: { children: [], passkeyCount: 0, locale: 'fr' as const, theme: 'system' as const }
    });
    expect(screen.getByText('Ajouter un enfant')).toBeTruthy();
  });

  it('renders all four legal links', () => {
    render(ProfilBento, { props: baseProps });
    expect(screen.getByText('CGU').closest('a')?.getAttribute('href')).toBe('/cgu');
    expect(screen.getByText('Mentions légales').closest('a')?.getAttribute('href')).toBe(
      '/mentions-legales'
    );
    expect(
      screen.getByText('Politique de confidentialité').closest('a')?.getAttribute('href')
    ).toBe('/politique-confidentialite');
    expect(screen.getByText('Cookies').closest('a')?.getAttribute('href')).toBe('/cookies');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/ProfilBento.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/ProfilBento.svelte`:

```svelte
<script lang="ts">
  import ChildCardRow from './ChildCardRow.svelte';
  import CoparentsSection from './CoparentsSection.svelte';
  import CompteSection from './CompteSection.svelte';
  import RgpdSection from './RgpdSection.svelte';
  import * as m from '$lib/paraglide/messages';
  import { Plus } from 'lucide-svelte';

  type ChildWithCoparents = {
    id: string;
    name: string;
    ageMonths: number;
    coparents: { id: string; displayName: string; role: string }[];
  };

  let {
    children,
    passkeyCount,
    locale,
    theme
  }: {
    children: ChildWithCoparents[];
    passkeyCount: number;
    locale: 'fr' | 'en';
    theme: 'system' | 'light' | 'dark';
  } = $props();
</script>

<div class="flex flex-col">
  <section class="mb-3" aria-label={m.profilChildrenTitle()}>
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
      {m.profilChildrenTitle()}
    </h2>
    {#each children as child (child.id)}
      <ChildCardRow {child} href={`/child/${child.id}/settings`} />
    {/each}
    <a
      href="/account#add-child"
      class="flex items-center gap-2 rounded-tile border border-dashed border-border bg-canvas px-4 py-3 text-sm font-semibold text-ink-soft transition-transform duration-base ease-soft active:scale-[0.99]"
    >
      <Plus size={18} aria-hidden="true" />
      {m.profilChildrenAdd()}
    </a>
  </section>

  {#each children as child (child.id)}
    <CoparentsSection
      childName={child.name}
      coparents={child.coparents}
      inviteHref={`/child/${child.id}/settings#invite`}
    />
  {/each}

  <CompteSection {passkeyCount} {locale} {theme} />
  <RgpdSection />

  <section class="mb-3" aria-label={m.profilLegalTitle()}>
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
      {m.profilLegalTitle()}
    </h2>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-primary">
      <li><a href="/cgu" class="underline">CGU</a></li>
      <li><a href="/mentions-legales" class="underline">Mentions légales</a></li>
      <li><a href="/politique-confidentialite" class="underline">Politique de confidentialité</a></li>
      <li><a href="/cookies" class="underline">Cookies</a></li>
    </ul>
  </section>
</div>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/ProfilBento.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/ProfilBento.svelte src/lib/components/bento/ProfilBento.test.ts
git commit -m "feat(bento): ProfilBento — children, coparents, compte, RGPD, légal"
```

---

### Task 16: monitor-timer utility + hook

**Files:**

- Create: `src/lib/utils/monitor-timer.ts`
- Create: `src/lib/utils/monitor-timer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/utils/monitor-timer.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadTimer,
  saveTimer,
  clearTimer,
  remainingMs,
  MONITOR_DURATION_MS
} from './monitor-timer';

describe('monitor-timer storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and reads back a started-at value', () => {
    saveTimer('entry-42', 1_700_000_000_000);
    expect(loadTimer('entry-42')).toEqual({ startedAt: 1_700_000_000_000 });
  });

  it('returns null when no timer is set', () => {
    expect(loadTimer('entry-42')).toBeNull();
  });

  it('clearTimer removes the key', () => {
    saveTimer('entry-42', 1_700_000_000_000);
    clearTimer('entry-42');
    expect(loadTimer('entry-42')).toBeNull();
  });
});

describe('remainingMs', () => {
  it('returns full duration when timer just started', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    expect(remainingMs({ startedAt: 1_700_000_000_000 })).toBe(MONITOR_DURATION_MS);
    vi.useRealTimers();
  });

  it('returns 0 when duration has elapsed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000 + MONITOR_DURATION_MS + 1000);
    expect(remainingMs({ startedAt: 1_700_000_000_000 })).toBe(0);
    vi.useRealTimers();
  });

  it('returns positive remaining when mid-flight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000 + 5_000);
    expect(remainingMs({ startedAt: 1_700_000_000_000 })).toBe(MONITOR_DURATION_MS - 5000);
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/utils/monitor-timer.test.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement**

Create `src/lib/utils/monitor-timer.ts`:

```ts
export const MONITOR_DURATION_MS = 30 * 60 * 1000;

export type TimerState = { startedAt: number };

function keyFor(entryId: string): string {
  return `monitor-timer:${entryId}`;
}

export function loadTimer(entryId: string): TimerState | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(keyFor(entryId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.startedAt === 'number') {
      return { startedAt: parsed.startedAt };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveTimer(entryId: string, startedAt: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(keyFor(entryId), JSON.stringify({ startedAt }));
}

export function clearTimer(entryId: string): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(keyFor(entryId));
}

export function remainingMs(state: TimerState, now: number = Date.now()): number {
  const elapsed = now - state.startedAt;
  return Math.max(0, MONITOR_DURATION_MS - elapsed);
}

export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/utils/monitor-timer.test.ts`
Expected: PASS

```bash
git add src/lib/utils/monitor-timer.ts src/lib/utils/monitor-timer.test.ts
git commit -m "feat(util): monitor-timer storage helpers + remainingMs"
```

---

### Task 17: ReassuranceHero component

**Files:**

- Create: `src/lib/components/bento/ReassuranceHero.svelte`
- Create: `src/lib/components/bento/ReassuranceHero.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/ReassuranceHero.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ReassuranceHero from './ReassuranceHero.svelte';

afterEach(() => cleanup());

describe('ReassuranceHero', () => {
  it('renders the reassurance body copy', () => {
    render(ReassuranceHero, {});
    expect(screen.getByText(/On vous accompagne/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/ReassuranceHero.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/ReassuranceHero.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
</script>

<section class="mb-3 rounded-hero bg-tile-peach p-5 shadow-soft">
  <p class="font-display text-xl italic leading-snug text-tile-peach-foreground">
    {m.reactionHeroBody()}
  </p>
</section>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/ReassuranceHero.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/ReassuranceHero.svelte src/lib/components/bento/ReassuranceHero.test.ts
git commit -m "feat(bento): ReassuranceHero — peach Fraunces italic reassurance"
```

---

### Task 18: StayCoolCard component

**Files:**

- Create: `src/lib/components/bento/StayCoolCard.svelte`
- Create: `src/lib/components/bento/StayCoolCard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/StayCoolCard.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import StayCoolCard from './StayCoolCard.svelte';

afterEach(() => cleanup());

describe('StayCoolCard', () => {
  it('renders title, body, and reactions guide link', () => {
    render(StayCoolCard, { props: { childId: 'abc' } });
    expect(screen.getByText('Respirez')).toBeTruthy();
    expect(screen.getByText(/Une réaction localisée/)).toBeTruthy();
    const link = screen.getByText('Voir le guide réactions').closest('a');
    expect(link?.getAttribute('href')).toBe('/child/abc/guide#reactions');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/StayCoolCard.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/StayCoolCard.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { ChevronRight } from 'lucide-svelte';

  let { childId }: { childId: string } = $props();
</script>

<section class="mb-3 rounded-tile bg-tile-mint p-4 shadow-soft">
  <p class="text-base font-bold leading-tight">{m.reactionStayCoolTitle()}</p>
  <p class="mt-1 text-sm text-tile-mint-foreground">{m.reactionStayCoolBody()}</p>
  <a
    href={`/child/${childId}/guide#reactions`}
    class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary"
  >
    {m.reactionStayCoolLink()}
    <ChevronRight size={14} aria-hidden="true" />
  </a>
</section>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/StayCoolCard.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/StayCoolCard.svelte src/lib/components/bento/StayCoolCard.test.ts
git commit -m "feat(bento): StayCoolCard — mint reassurance + guide link"
```

---

### Task 19: SevereRail component

**Files:**

- Create: `src/lib/components/bento/SevereRail.svelte`
- Create: `src/lib/components/bento/SevereRail.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/SevereRail.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import SevereRail from './SevereRail.svelte';

afterEach(() => cleanup());

describe('SevereRail', () => {
  it('renders the severe rail body', () => {
    render(SevereRail, {});
    expect(screen.getByText(/Difficulté à respirer/)).toBeTruthy();
  });

  it('uses role="alert" so screen readers announce it', () => {
    const { container } = render(SevereRail, {});
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
  });

  it('wraps the rail in a tel:15 link', () => {
    render(SevereRail, {});
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('tel:15');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/SevereRail.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/SevereRail.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { Phone } from 'lucide-svelte';
</script>

<a
  href="tel:15"
  role="alert"
  class="mb-3 flex items-center gap-3 rounded-tile bg-severe px-4 py-3 text-severe-foreground shadow-soft"
>
  <Phone size={18} aria-hidden="true" />
  <p class="text-sm font-bold leading-tight">{m.reactionSevereRailBody()}</p>
</a>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/SevereRail.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/SevereRail.svelte src/lib/components/bento/SevereRail.test.ts
git commit -m "feat(bento): SevereRail — coral tel:15 rail with role=alert"
```

---

### Task 20: SymptomRow component

**Files:**

- Create: `src/lib/components/bento/SymptomRow.svelte`
- Create: `src/lib/components/bento/SymptomRow.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/SymptomRow.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import SymptomRow from './SymptomRow.svelte';

afterEach(() => cleanup());

describe('SymptomRow', () => {
  it('renders the label, time, and optional note', () => {
    render(SymptomRow, {
      props: { label: 'rougeur', observedAt: '11:42', note: 'sur la joue gauche' }
    });
    expect(screen.getByText('Rougeur')).toBeTruthy();
    expect(screen.getByText('11:42')).toBeTruthy();
    expect(screen.getByText('sur la joue gauche')).toBeTruthy();
  });

  it('hides the note paragraph when note is null', () => {
    const { container } = render(SymptomRow, {
      props: { label: 'rougeur', observedAt: '11:42', note: null }
    });
    const noteCount = container.querySelectorAll('p').length;
    expect(noteCount).toBe(2);
  });

  it('applies butter background for warn severity', () => {
    const { container } = render(SymptomRow, {
      props: { label: 'vomissement', observedAt: '12:00', note: null }
    });
    expect(container.querySelector('.bg-tile-butter')).toBeTruthy();
  });

  it('applies severe background and aria-live for severe severity', () => {
    const { container } = render(SymptomRow, {
      props: { label: 'gonflement', observedAt: '12:00', note: null }
    });
    expect(container.querySelector('.bg-severe')).toBeTruthy();
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/SymptomRow.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/SymptomRow.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { severityOf, type SymptomLabel } from '$lib/content/symptoms';
  import { cn } from '$lib/utils/cn';

  let {
    label,
    observedAt,
    note
  }: { label: SymptomLabel; observedAt: string; note: string | null } = $props();

  const severity = $derived(severityOf(label));

  function labelText(l: SymptomLabel): string {
    const key = `symptomsLabel${l
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')}` as
      | 'symptomsLabelRougeur'
      | 'symptomsLabelUrticaire'
      | 'symptomsLabelEczema'
      | 'symptomsLabelVomissement'
      | 'symptomsLabelDiarrhee'
      | 'symptomsLabelGonflement'
      | 'symptomsLabelToux'
      | 'symptomsLabelDetresseRespiratoire'
      | 'symptomsLabelLevresBleues'
      | 'symptomsLabelAutre';
    return m[key]();
  }
</script>

<li
  aria-live={severity === 'severe' ? 'polite' : undefined}
  class={cn(
    'flex items-start gap-3 rounded-tile border px-3 py-2 shadow-soft',
    severity === 'neutral' && 'border-border bg-surface',
    severity === 'warn' && 'border-warning bg-tile-butter',
    severity === 'severe' && 'border-severe bg-severe text-severe-foreground'
  )}
>
  <span class="font-mono text-xs">{observedAt}</span>
  <span class="flex-1">
    <p class="text-sm font-bold">{labelText(label)}</p>
    {#if note}
      <p class="text-xs">{note}</p>
    {/if}
  </span>
</li>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/SymptomRow.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/SymptomRow.svelte src/lib/components/bento/SymptomRow.test.ts
git commit -m "feat(bento): SymptomRow — severity-tinted row with time + label + note"
```

---

### Task 21: SymptomList component

**Files:**

- Create: `src/lib/components/bento/SymptomList.svelte`
- Create: `src/lib/components/bento/SymptomList.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/SymptomList.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import SymptomList from './SymptomList.svelte';

afterEach(() => cleanup());

describe('SymptomList', () => {
  const symptoms = [
    { id: 1, label: 'rougeur' as const, observedAt: '11:42', note: 'joue gauche' },
    { id: 2, label: 'vomissement' as const, observedAt: '12:10', note: null }
  ];

  it('renders one row per symptom', () => {
    render(SymptomList, { props: { symptoms, onAdd: () => {} } });
    expect(screen.getByText('Rougeur')).toBeTruthy();
    expect(screen.getByText('Vomissement')).toBeTruthy();
  });

  it('renders the empty placeholder when list is empty', () => {
    render(SymptomList, { props: { symptoms: [], onAdd: () => {} } });
    expect(screen.getByText("Aucun symptôme enregistré pour l'instant.")).toBeTruthy();
  });

  it('renders the add row in both states', async () => {
    const onAdd = vi.fn();
    render(SymptomList, { props: { symptoms, onAdd } });
    await fireEvent.click(screen.getByText('Ajouter un symptôme'));
    expect(onAdd).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/SymptomList.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/SymptomList.svelte`:

```svelte
<script lang="ts">
  import SymptomRow from './SymptomRow.svelte';
  import * as m from '$lib/paraglide/messages';
  import { Plus } from 'lucide-svelte';
  import type { SymptomLabel } from '$lib/content/symptoms';

  type SymptomEntry = { id: number; label: SymptomLabel; observedAt: string; note: string | null };

  let {
    symptoms,
    onAdd
  }: { symptoms: SymptomEntry[]; onAdd: () => void } = $props();
</script>

<section class="mb-3" aria-label={m.reactionSymptomsTitle()}>
  <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
    {m.reactionSymptomsTitle()}
  </h2>
  {#if symptoms.length === 0}
    <p class="mb-2 rounded-tile border border-dashed border-border bg-canvas p-3 text-center text-sm text-ink-soft">
      {m.reactionSymptomsEmpty()}
    </p>
  {:else}
    <ul class="mb-2 flex flex-col gap-2">
      {#each symptoms as s (s.id)}
        <SymptomRow label={s.label} observedAt={s.observedAt} note={s.note} />
      {/each}
    </ul>
  {/if}
  <button
    type="button"
    onclick={onAdd}
    class="flex w-full items-center justify-center gap-2 rounded-tile border border-dashed border-border bg-canvas px-3 py-2 text-sm font-semibold text-ink-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    <Plus size={16} aria-hidden="true" />
    {m.reactionSymptomsAdd()}
  </button>
</section>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/SymptomList.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/SymptomList.svelte src/lib/components/bento/SymptomList.test.ts
git commit -m "feat(bento): SymptomList — chronological severity-tinted rows + add"
```

---

### Task 22: AddSymptomSheet component

**Files:**

- Create: `src/lib/components/bento/AddSymptomSheet.svelte`
- Create: `src/lib/components/bento/AddSymptomSheet.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/AddSymptomSheet.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import AddSymptomSheet from './AddSymptomSheet.svelte';

afterEach(() => cleanup());

describe('AddSymptomSheet', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(AddSymptomSheet, {
      props: { open: false, action: '/child/abc/foods/1', onClose: () => {} }
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders all 10 picklist labels when open', () => {
    render(AddSymptomSheet, {
      props: { open: true, action: '/child/abc/foods/1', onClose: () => {} }
    });
    expect(screen.getByText('Rougeur')).toBeTruthy();
    expect(screen.getByText('Urticaire')).toBeTruthy();
    expect(screen.getByText('Eczéma')).toBeTruthy();
    expect(screen.getByText('Vomissement')).toBeTruthy();
    expect(screen.getByText('Diarrhée')).toBeTruthy();
    expect(screen.getByText('Gonflement')).toBeTruthy();
    expect(screen.getByText('Toux')).toBeTruthy();
    expect(screen.getByText('Détresse respiratoire')).toBeTruthy();
    expect(screen.getByText('Lèvres bleues')).toBeTruthy();
    expect(screen.getByText('Autre')).toBeTruthy();
  });

  it('renders the note input + submit', () => {
    render(AddSymptomSheet, {
      props: { open: true, action: '/child/abc/foods/1', onClose: () => {} }
    });
    expect(screen.getByLabelText('Note (optionnelle)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enregistrer le symptôme' })).toBeTruthy();
  });

  it('submits the form to the provided action with ?/addSymptom', () => {
    render(AddSymptomSheet, {
      props: { open: true, action: '/child/abc/foods/1', onClose: () => {} }
    });
    const form = screen.getByRole('button', { name: 'Enregistrer le symptôme' }).closest('form');
    expect(form?.getAttribute('action')).toBe('/child/abc/foods/1?/addSymptom');
    expect(form?.getAttribute('method')).toBe('POST');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/AddSymptomSheet.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/AddSymptomSheet.svelte`:

```svelte
<script lang="ts">
  import { Sheet } from 'bits-ui';
  import * as m from '$lib/paraglide/messages';
  import { SYMPTOM_LABELS, type SymptomLabel } from '$lib/content/symptoms';

  let {
    open,
    action,
    onClose
  }: { open: boolean; action: string; onClose: () => void } = $props();

  let selected = $state<SymptomLabel>('rougeur');
  let note = $state('');
  let observedAt = $state(new Date().toTimeString().slice(0, 5));

  function labelText(l: SymptomLabel): string {
    const key = `symptomsLabel${l
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')}` as
      | 'symptomsLabelRougeur'
      | 'symptomsLabelUrticaire'
      | 'symptomsLabelEczema'
      | 'symptomsLabelVomissement'
      | 'symptomsLabelDiarrhee'
      | 'symptomsLabelGonflement'
      | 'symptomsLabelToux'
      | 'symptomsLabelDetresseRespiratoire'
      | 'symptomsLabelLevresBleues'
      | 'symptomsLabelAutre';
    return m[key]();
  }
</script>

<Sheet.Root bind:open={
    () => open,
    (v) => {
      if (!v) onClose();
    }
  }>
  <Sheet.Portal>
    <Sheet.Overlay class="fixed inset-0 z-40 bg-ink/40" />
    <Sheet.Content
      side="bottom"
      class="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-hero bg-surface px-4 py-5 shadow-lifted"
    >
      <div class="mx-auto mb-3 h-1 w-12 rounded-full bg-border" aria-hidden="true"></div>
      <Sheet.Title class="font-display text-xl italic">{m.addSymptomTitle()}</Sheet.Title>
      <form method="POST" action={`${action}?/addSymptom`} class="mt-4">
        <fieldset>
          <legend class="text-xs font-semibold uppercase tracking-wider text-ink-soft">
            {m.addSymptomLabel()}
          </legend>
          <div class="mt-2 grid grid-cols-2 gap-2">
            {#each SYMPTOM_LABELS as label (label)}
              <label class="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold {selected === label ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-canvas text-ink-soft'}">
                <input
                  type="radio"
                  name="label"
                  value={label}
                  checked={selected === label}
                  onchange={() => (selected = label)}
                  class="sr-only"
                />
                {labelText(label)}
              </label>
            {/each}
          </div>
        </fieldset>

        <label class="mt-4 block text-xs font-semibold uppercase tracking-wider text-ink-soft" for="symptom-note">
          {m.addSymptomNote()}
        </label>
        <textarea
          id="symptom-note"
          name="note"
          maxlength="280"
          bind:value={note}
          placeholder={m.addSymptomNotePlaceholder()}
          class="mt-1 w-full rounded-tile border border-border bg-canvas p-2 text-sm"
          rows="3"
        ></textarea>

        <label class="mt-4 block text-xs font-semibold uppercase tracking-wider text-ink-soft" for="symptom-observed-at">
          {m.addSymptomObservedAt()}
        </label>
        <input
          id="symptom-observed-at"
          type="time"
          name="observedAt"
          bind:value={observedAt}
          class="mt-1 rounded-tile border border-border bg-canvas px-3 py-2 text-sm"
        />

        <button
          type="submit"
          class="mt-5 w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
        >
          {m.addSymptomSubmit()}
        </button>
      </form>
    </Sheet.Content>
  </Sheet.Portal>
</Sheet.Root>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/AddSymptomSheet.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/AddSymptomSheet.svelte src/lib/components/bento/AddSymptomSheet.test.ts
git commit -m "feat(bento): AddSymptomSheet — picklist + note + observed_at form"
```

---

### Task 23: MonitorTimer component

**Files:**

- Create: `src/lib/components/bento/MonitorTimer.svelte`
- Create: `src/lib/components/bento/MonitorTimer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/MonitorTimer.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import MonitorTimer from './MonitorTimer.svelte';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('MonitorTimer', () => {
  it('renders the start CTA when not started', () => {
    render(MonitorTimer, { props: { entryId: 'e-1' } });
    expect(screen.getByRole('button', { name: /Suivre 30 min/ })).toBeTruthy();
  });

  it('starts the timer and shows MM:SS when tapped', async () => {
    render(MonitorTimer, { props: { entryId: 'e-1' } });
    await fireEvent.click(screen.getByRole('button', { name: /Suivre 30 min/ }));
    expect(screen.getByText(/Surveillance/)).toBeTruthy();
  });

  it('restores state from localStorage on mount', () => {
    localStorage.setItem('monitor-timer:e-1', JSON.stringify({ startedAt: Date.now() - 5_000 }));
    render(MonitorTimer, { props: { entryId: 'e-1' } });
    expect(screen.getByText(/Surveillance/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/MonitorTimer.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/MonitorTimer.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import {
    loadTimer,
    saveTimer,
    clearTimer,
    remainingMs,
    formatRemaining,
    MONITOR_DURATION_MS
  } from '$lib/utils/monitor-timer';
  import { onMount } from 'svelte';

  let { entryId }: { entryId: string } = $props();

  let startedAt = $state<number | null>(null);
  let now = $state(Date.now());

  onMount(() => {
    const existing = loadTimer(entryId);
    if (existing) {
      startedAt = existing.startedAt;
    }
    const tick = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(tick);
  });

  const remaining = $derived(
    startedAt === null ? MONITOR_DURATION_MS : remainingMs({ startedAt }, now)
  );

  function start() {
    const ts = Date.now();
    startedAt = ts;
    saveTimer(entryId, ts);
  }

  $effect(() => {
    if (startedAt !== null && remaining === 0) {
      clearTimer(entryId);
    }
  });
</script>

{#if startedAt === null}
  <button
    type="button"
    onclick={start}
    class="mb-2 w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    {m.reactionTimerStart()}
  </button>
{:else if remaining > 0}
  <p class="mb-2 rounded-full bg-tile-mint px-4 py-3 text-center text-sm font-bold text-tile-mint-foreground">
    {m.reactionTimerRunning({ time: formatRemaining(remaining) })}
  </p>
{:else}
  <p class="mb-2 rounded-full bg-tile-mint px-4 py-3 text-center text-sm font-bold text-tile-mint-foreground">
    {m.reactionTimerDone()}
  </p>
{/if}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/MonitorTimer.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/MonitorTimer.svelte src/lib/components/bento/MonitorTimer.test.ts
git commit -m "feat(bento): MonitorTimer — 30-min localStorage countdown"
```

---

### Task 24: RasCard component

**Files:**

- Create: `src/lib/components/bento/RasCard.svelte`
- Create: `src/lib/components/bento/RasCard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/RasCard.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import RasCard from './RasCard.svelte';

afterEach(() => cleanup());

describe('RasCard', () => {
  it('renders the RAS message with Nth exposition', () => {
    render(RasCard, { props: { nth: 3 } });
    expect(screen.getByText(/3 exposition/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/RasCard.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/RasCard.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  let { nth }: { nth: number } = $props();
</script>

<section class="mb-3 rounded-tile bg-tile-mint p-4 shadow-soft">
  <p class="text-sm font-semibold text-tile-mint-foreground">
    {m.reactionRasMessage({ nth: String(nth) })}
  </p>
</section>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/RasCard.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/RasCard.svelte src/lib/components/bento/RasCard.test.ts
git commit -m "feat(bento): RasCard — calm mint card for RAS food entries"
```

---

### Task 25: ReactionDetailBento composer

**Files:**

- Create: `src/lib/components/bento/ReactionDetailBento.svelte`
- Create: `src/lib/components/bento/ReactionDetailBento.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/ReactionDetailBento.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ReactionDetailBento from './ReactionDetailBento.svelte';

afterEach(() => cleanup());

describe('ReactionDetailBento', () => {
  const baseProps = {
    childId: 'abc',
    entryId: 1,
    food: 'Poire',
    nth: 2,
    date: '15 mai',
    time: '11:30',
    symptoms: [{ id: 1, label: 'rougeur' as const, observedAt: '11:42', note: 'joue gauche' }],
    printHref: '/child/abc/foods/1/print'
  };

  it('renders the title and subtitle', () => {
    render(ReactionDetailBento, { props: baseProps });
    expect(screen.getByText('Réaction · Poire')).toBeTruthy();
    expect(screen.getByText('15 mai · 11:30 · 2 exposition')).toBeTruthy();
  });

  it('renders all five panels (hero, symptoms, stay-cool, severe, monitor)', () => {
    render(ReactionDetailBento, { props: baseProps });
    expect(screen.getByText(/On vous accompagne/)).toBeTruthy();
    expect(screen.getByText('Symptômes observés')).toBeTruthy();
    expect(screen.getByText('Respirez')).toBeTruthy();
    expect(screen.getByText(/Difficulté à respirer/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Suivre 30 min/ })).toBeTruthy();
  });

  it('renders the export CTA linking to the print href', () => {
    render(ReactionDetailBento, { props: baseProps });
    const link = screen.getByText('Exporter pour le pédiatre').closest('a');
    expect(link?.getAttribute('href')).toBe('/child/abc/foods/1/print');
    expect(link?.getAttribute('target')).toBe('_blank');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/ReactionDetailBento.test.ts`
Expected: FAIL — component file missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/ReactionDetailBento.svelte`:

```svelte
<script lang="ts">
  import ReassuranceHero from './ReassuranceHero.svelte';
  import SymptomList from './SymptomList.svelte';
  import AddSymptomSheet from './AddSymptomSheet.svelte';
  import StayCoolCard from './StayCoolCard.svelte';
  import SevereRail from './SevereRail.svelte';
  import MonitorTimer from './MonitorTimer.svelte';
  import * as m from '$lib/paraglide/messages';
  import type { SymptomLabel } from '$lib/content/symptoms';
  import { ChevronLeft } from 'lucide-svelte';

  type SymptomEntry = { id: number; label: SymptomLabel; observedAt: string; note: string | null };

  let {
    childId,
    entryId,
    food,
    nth,
    date,
    time,
    symptoms,
    printHref
  }: {
    childId: string;
    entryId: number;
    food: string;
    nth: number;
    date: string;
    time: string;
    symptoms: SymptomEntry[];
    printHref: string;
  } = $props();

  let addOpen = $state(false);
</script>

<div class="flex flex-col">
  <a
    href={`/child/${childId}/foods`}
    class="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft"
  >
    <ChevronLeft size={16} aria-hidden="true" />
    {m.reactionBackToCarnet()}
  </a>
  <h1 class="font-display text-2xl italic leading-tight">
    {m.reactionTitle({ food })}
  </h1>
  <p class="mb-3 text-xs text-ink-soft">
    {m.reactionSubtitle({ date, time, nth: String(nth) })}
  </p>

  <ReassuranceHero />
  <SymptomList {symptoms} onAdd={() => (addOpen = true)} />
  <StayCoolCard {childId} />
  <SevereRail />
  <MonitorTimer entryId={String(entryId)} />

  <a
    href={printHref}
    target="_blank"
    rel="noopener"
    class="mb-3 inline-block w-full rounded-full border border-primary px-4 py-3 text-center text-sm font-bold text-primary shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    {m.reactionExport()}
  </a>
</div>

<AddSymptomSheet
  open={addOpen}
  action={`/child/${childId}/foods/${entryId}`}
  onClose={() => (addOpen = false)}
/>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/components/bento/ReactionDetailBento.test.ts`
Expected: PASS

```bash
git add src/lib/components/bento/ReactionDetailBento.svelte src/lib/components/bento/ReactionDetailBento.test.ts
git commit -m "feat(bento): ReactionDetailBento — composes hero, symptoms, rails, timer"
```

---

### Task 26: Symptom server queries

**Files:**

- Create: `src/lib/server/db/symptoms.ts`
- Create: `src/lib/server/db/symptoms.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/db/symptoms.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { resetTestDb, seedChild, seedFood, seedFoodEntry } from './seed';
import { listSymptomsByEntry, insertSymptom, countNthExposition } from './symptoms';
import { db } from './index';
import { symptoms } from './schema';

describe('symptoms queries', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('listSymptomsByEntry returns rows in ascending observed_at', async () => {
    const child = await seedChild({ name: 'Léo' });
    const food = await seedFood({ name: 'Poire' });
    const entry = await seedFoodEntry({ childId: child.id, foodId: food.id, reaction: 'reaction' });
    await db.insert(symptoms).values([
      {
        foodEntryId: entry.id,
        childId: child.id,
        observedAt: new Date('2026-05-01T12:10:00Z'),
        label: 'vomissement',
        note: null
      },
      {
        foodEntryId: entry.id,
        childId: child.id,
        observedAt: new Date('2026-05-01T11:42:00Z'),
        label: 'rougeur',
        note: 'joue gauche'
      }
    ]);
    const list = await listSymptomsByEntry(entry.id);
    expect(list).toHaveLength(2);
    expect(list[0].label).toBe('rougeur');
    expect(list[1].label).toBe('vomissement');
  });

  it('insertSymptom persists a row', async () => {
    const child = await seedChild({ name: 'Léo' });
    const food = await seedFood({ name: 'Poire' });
    const entry = await seedFoodEntry({ childId: child.id, foodId: food.id, reaction: 'reaction' });
    await insertSymptom({
      foodEntryId: entry.id,
      childId: child.id,
      observedAt: new Date('2026-05-01T11:42:00Z'),
      label: 'rougeur',
      note: 'joue gauche',
      createdBy: 1
    });
    const list = await listSymptomsByEntry(entry.id);
    expect(list).toHaveLength(1);
    expect(list[0].note).toBe('joue gauche');
  });

  it('countNthExposition counts entries up to and including the given entry', async () => {
    const child = await seedChild({ name: 'Léo' });
    const food = await seedFood({ name: 'Poire' });
    const e1 = await seedFoodEntry({
      childId: child.id,
      foodId: food.id,
      givenAt: new Date('2026-04-01'),
      reaction: 'ras'
    });
    const e2 = await seedFoodEntry({
      childId: child.id,
      foodId: food.id,
      givenAt: new Date('2026-04-15'),
      reaction: 'ras'
    });
    const e3 = await seedFoodEntry({
      childId: child.id,
      foodId: food.id,
      givenAt: new Date('2026-05-01'),
      reaction: 'reaction'
    });
    expect(await countNthExposition(e1.id)).toBe(1);
    expect(await countNthExposition(e2.id)).toBe(2);
    expect(await countNthExposition(e3.id)).toBe(3);
  });
});
```

> **Note:** if `seedFood` / `seedFoodEntry` / `seedChild` signatures don't match, adapt the test setup to call whatever helpers already exist (`src/lib/server/db/seed.ts`). Don't invent new helpers.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/db/symptoms.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the queries**

Create `src/lib/server/db/symptoms.ts`:

```ts
import { and, asc, eq, lte, sql } from 'drizzle-orm';
import { db } from './index';
import { foodEntries, symptoms } from './schema';
import type { SymptomLabel } from '$lib/content/symptoms';

export async function listSymptomsByEntry(foodEntryId: number) {
  const rows = await db
    .select()
    .from(symptoms)
    .where(eq(symptoms.foodEntryId, foodEntryId))
    .orderBy(asc(symptoms.observedAt));
  return rows.map((r) => ({
    id: r.id,
    label: r.label as SymptomLabel,
    observedAt: r.observedAt,
    note: r.note
  }));
}

export async function insertSymptom(input: {
  foodEntryId: number;
  childId: number;
  observedAt: Date;
  label: SymptomLabel;
  note: string | null;
  createdBy: number;
}): Promise<void> {
  await db.insert(symptoms).values({
    foodEntryId: input.foodEntryId,
    childId: input.childId,
    observedAt: input.observedAt,
    label: input.label,
    note: input.note,
    createdBy: input.createdBy
  });
}

export async function countNthExposition(foodEntryId: number): Promise<number> {
  const row = (
    await db
      .select({
        childId: foodEntries.childId,
        foodId: foodEntries.foodId,
        givenAt: foodEntries.givenAt
      })
      .from(foodEntries)
      .where(eq(foodEntries.id, foodEntryId))
      .limit(1)
  )[0];
  if (!row) return 0;
  const countRow = (
    await db
      .select({ count: sql<number>`count(*)::int` })
      .from(foodEntries)
      .where(
        and(
          eq(foodEntries.childId, row.childId),
          eq(foodEntries.foodId, row.foodId),
          lte(foodEntries.givenAt, row.givenAt)
        )
      )
  )[0];
  return countRow?.count ?? 0;
}
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/lib/server/db/symptoms.test.ts`
Expected: PASS

```bash
git add src/lib/server/db/symptoms.ts src/lib/server/db/symptoms.test.ts
git commit -m "feat(db): symptoms queries — list, insert, countNthExposition"
```

---

### Task 27: Reaction-detail route loader + addSymptom action

**Files:**

- Create: `src/routes/child/[id]/foods/[entryId]/+page.server.ts`
- Create: `src/routes/child/[id]/foods/[entryId]/page.server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/routes/child/[id]/foods/[entryId]/page.server.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { load, actions } from './+page.server';
import {
  resetTestDb,
  seedUser,
  seedChild,
  seedFood,
  seedFoodEntry,
  seedMembership
} from '$lib/server/db/seed';

function fakeEvent(opts: {
  user: { id: number; locale: 'fr' | 'en' };
  childId: string;
  entryId: string;
  form?: URLSearchParams;
}) {
  return {
    locals: { user: opts.user, locale: opts.user.locale },
    params: { id: opts.childId, entryId: opts.entryId },
    request: { formData: async () => opts.form ?? new URLSearchParams() }
  } as unknown as Parameters<typeof load>[0];
}

describe('reaction-detail loader', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('returns the entry, food name, symptoms, nth, and computed RAS flag', async () => {
    const user = await seedUser({ email: 'a@b.c' });
    const child = await seedChild({ name: 'Léo' });
    await seedMembership({ userId: user.id, childId: child.id, role: 'owner' });
    const food = await seedFood({ name: 'Poire' });
    const entry = await seedFoodEntry({
      childId: child.id,
      foodId: food.id,
      reaction: 'reaction'
    });
    const data = await load(
      fakeEvent({
        user: { id: user.id, locale: 'fr' },
        childId: String(child.id),
        entryId: String(entry.id)
      })
    );
    expect(data.food).toBe('Poire');
    expect(data.isRas).toBe(false);
    expect(data.nth).toBe(1);
    expect(data.symptoms).toEqual([]);
  });

  it('returns isRas=true when reaction is ras', async () => {
    const user = await seedUser({ email: 'a@b.c' });
    const child = await seedChild({ name: 'Léo' });
    await seedMembership({ userId: user.id, childId: child.id, role: 'owner' });
    const food = await seedFood({ name: 'Poire' });
    const entry = await seedFoodEntry({
      childId: child.id,
      foodId: food.id,
      reaction: 'ras'
    });
    const data = await load(
      fakeEvent({
        user: { id: user.id, locale: 'fr' },
        childId: String(child.id),
        entryId: String(entry.id)
      })
    );
    expect(data.isRas).toBe(true);
  });

  it('throws 404 when the entry does not belong to the child', async () => {
    const user = await seedUser({ email: 'a@b.c' });
    const a = await seedChild({ name: 'Léo' });
    const b = await seedChild({ name: 'Maya' });
    await seedMembership({ userId: user.id, childId: a.id, role: 'owner' });
    await seedMembership({ userId: user.id, childId: b.id, role: 'owner' });
    const food = await seedFood({ name: 'Poire' });
    const entry = await seedFoodEntry({ childId: b.id, foodId: food.id, reaction: 'ras' });
    await expect(
      load(
        fakeEvent({
          user: { id: user.id, locale: 'fr' },
          childId: String(a.id),
          entryId: String(entry.id)
        })
      )
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('addSymptom action', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('inserts a symptom for valid input', async () => {
    const user = await seedUser({ email: 'a@b.c' });
    const child = await seedChild({ name: 'Léo' });
    await seedMembership({ userId: user.id, childId: child.id, role: 'owner' });
    const food = await seedFood({ name: 'Poire' });
    const entry = await seedFoodEntry({
      childId: child.id,
      foodId: food.id,
      reaction: 'reaction'
    });
    const form = new URLSearchParams({
      label: 'rougeur',
      note: 'joue gauche',
      observedAt: '11:42'
    });
    const result = await actions.addSymptom(
      fakeEvent({
        user: { id: user.id, locale: 'fr' },
        childId: String(child.id),
        entryId: String(entry.id),
        form
      })
    );
    expect(result).toEqual({ success: true });
  });

  it('rejects an unknown label', async () => {
    const user = await seedUser({ email: 'a@b.c' });
    const child = await seedChild({ name: 'Léo' });
    await seedMembership({ userId: user.id, childId: child.id, role: 'owner' });
    const food = await seedFood({ name: 'Poire' });
    const entry = await seedFoodEntry({
      childId: child.id,
      foodId: food.id,
      reaction: 'reaction'
    });
    const form = new URLSearchParams({ label: 'not-a-symptom', note: '', observedAt: '11:42' });
    const result = await actions.addSymptom(
      fakeEvent({
        user: { id: user.id, locale: 'fr' },
        childId: String(child.id),
        entryId: String(entry.id),
        form
      })
    );
    expect(result).toMatchObject({ status: 400 });
  });
});
```

> **Note:** seed helper signatures vary across the codebase; if `seedMembership` doesn't exist, write a one-line wrapper that calls `db.insert(memberships).values(...)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/routes/child/[id]/foods/[entryId]/page.server.test.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement the loader and action**

Create `src/routes/child/[id]/foods/[entryId]/+page.server.ts`:

```ts
import { error, fail } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { foodEntries, foods } from '$lib/server/db/schema';
import { listSymptomsByEntry, insertSymptom, countNthExposition } from '$lib/server/db/symptoms';
import { requireUser } from '$lib/server/guards';
import { assertChildAccess } from '$lib/server/guards';
import { SYMPTOM_LABELS, type SymptomLabel } from '$lib/content/symptoms';
import { audit } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const user = requireUser(locals);
  const childId = Number(params.id);
  const entryId = Number(params.entryId);
  await assertChildAccess(user.id, childId);

  const row = (
    await db
      .select({
        id: foodEntries.id,
        childId: foodEntries.childId,
        foodId: foodEntries.foodId,
        givenAt: foodEntries.givenAt,
        reaction: foodEntries.reaction,
        foodName: foods.name
      })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, childId)))
      .limit(1)
  )[0];
  if (!row) throw error(404, 'Food entry not found');

  const symptoms = (await listSymptomsByEntry(entryId)).map((s) => ({
    id: s.id,
    label: s.label,
    observedAt: formatTime(s.observedAt, locals.locale ?? 'fr'),
    note: s.note
  }));
  const nth = await countNthExposition(entryId);

  return {
    entryId,
    food: row.foodName,
    isRas: row.reaction === 'ras',
    nth,
    date: formatDate(row.givenAt, locals.locale ?? 'fr'),
    time: formatTime(row.givenAt, locals.locale ?? 'fr'),
    symptoms
  };
};

const addSchema = z.object({
  label: z.enum(SYMPTOM_LABELS as unknown as [SymptomLabel, ...SymptomLabel[]]),
  note: z.string().max(280).optional().default(''),
  observedAt: z.string().regex(/^\d{2}:\d{2}$/)
});

export const actions: Actions = {
  addSymptom: async ({ locals, params, request }) => {
    const user = requireUser(locals);
    const childId = Number(params.id);
    const entryId = Number(params.entryId);
    await assertChildAccess(user.id, childId);

    const raw = Object.fromEntries(await request.formData());
    const parsed = addSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, { error: 'invalid-input' });
    }
    const [hh, mm] = parsed.data.observedAt.split(':').map(Number);
    const observedAt = new Date();
    observedAt.setHours(hh, mm, 0, 0);

    await insertSymptom({
      foodEntryId: entryId,
      childId,
      observedAt,
      label: parsed.data.label,
      note: parsed.data.note.trim() || null,
      createdBy: user.id
    });

    audit({
      type: 'symptom.added',
      userId: user.id,
      childId,
      entryId,
      label: parsed.data.label
    });
    return { success: true };
  }
};

function formatDate(d: Date, locale: 'fr' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    day: 'numeric',
    month: 'long'
  }).format(d);
}

function formatTime(d: Date, locale: 'fr' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}
```

> **Note:** if `assertChildAccess` doesn't exist under that exact name, find the existing helper used by `/child/[id]/foods/+page.server.ts` and import it. The audit type `'symptom.added'` may need to be added to the audit event union in `src/lib/server/audit.ts`.

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/routes/child/[id]/foods/[entryId]/page.server.test.ts`
Expected: PASS

```bash
git add src/routes/child/[id]/foods/[entryId]/+page.server.ts src/routes/child/[id]/foods/[entryId]/page.server.test.ts
git commit -m "feat(reaction): /foods/[entryId] loader + addSymptom action"
```

---

### Task 28: Reaction-detail page Svelte

**Files:**

- Create: `src/routes/child/[id]/foods/[entryId]/+page.svelte`

- [ ] **Step 1: Implement directly (page Svelte tested via e2e in task 35)**

Create `src/routes/child/[id]/foods/[entryId]/+page.svelte`:

```svelte
<script lang="ts">
  import ReactionDetailBento from '$lib/components/bento/ReactionDetailBento.svelte';
  import RasCard from '$lib/components/bento/RasCard.svelte';
  import * as m from '$lib/paraglide/messages';
  import { ChevronLeft } from 'lucide-svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

{#if data.isRas}
  <div class="flex flex-col">
    <a
      href={`/child/${data.entryId}/foods`}
      class="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft"
    >
      <ChevronLeft size={16} aria-hidden="true" />
      {m.reactionBackToCarnet()}
    </a>
    <h1 class="font-display text-2xl italic leading-tight">
      {m.reactionTitle({ food: data.food })}
    </h1>
    <p class="mb-3 text-xs text-ink-soft">
      {m.reactionSubtitle({ date: data.date, time: data.time, nth: String(data.nth) })}
    </p>
    <RasCard nth={data.nth} />
  </div>
{:else}
  <ReactionDetailBento
    childId={String(data.entryId)}
    entryId={data.entryId}
    food={data.food}
    nth={data.nth}
    date={data.date}
    time={data.time}
    symptoms={data.symptoms}
    printHref={`/child/${data.entryId}/foods/${data.entryId}/print`}
  />
{/if}
```

> **Important:** the `childId` and `printHref` in this snippet read `data.entryId` placeholders that need the actual `child.id`; rebuild the loader to also return `childId` (or read from `$page.params.id`). Use `$app/stores` to derive `childId` from `$page.params.id` inside the Svelte file — or extend the loader to return it.

Recommended fix during implementation: extend the loader to return `childId` derived from `params.id` and pass it through. Update the test expectation accordingly.

- [ ] **Step 2: Commit**

```bash
git add src/routes/child/[id]/foods/[entryId]/+page.svelte
git commit -m "feat(reaction): /foods/[entryId] Svelte page renders RAS or bento"
```

---

### Task 29: Print page route

**Files:**

- Create: `src/routes/child/[id]/foods/[entryId]/print/+page.server.ts`
- Create: `src/routes/child/[id]/foods/[entryId]/print/+page.svelte`
- Create: `src/routes/child/[id]/foods/[entryId]/print/page.server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/routes/child/[id]/foods/[entryId]/print/page.server.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { load } from './+page.server';
import {
  resetTestDb,
  seedUser,
  seedChild,
  seedFood,
  seedFoodEntry,
  seedMembership
} from '$lib/server/db/seed';
import { db } from '$lib/server/db';
import { symptoms } from '$lib/server/db/schema';

describe('print loader', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  it('returns child, food, symptoms, and generated_at', async () => {
    const user = await seedUser({ email: 'a@b.c' });
    const child = await seedChild({ name: 'Léo' });
    await seedMembership({ userId: user.id, childId: child.id, role: 'owner' });
    const food = await seedFood({ name: 'Poire' });
    const entry = await seedFoodEntry({
      childId: child.id,
      foodId: food.id,
      reaction: 'reaction'
    });
    await db.insert(symptoms).values({
      foodEntryId: entry.id,
      childId: child.id,
      observedAt: new Date('2026-05-01T11:42:00Z'),
      label: 'rougeur',
      note: null
    });
    const data = await load({
      locals: { user, locale: 'fr' },
      params: { id: String(child.id), entryId: String(entry.id) }
    } as unknown as Parameters<typeof load>[0]);
    expect(data.childName).toBe('Léo');
    expect(data.foodName).toBe('Poire');
    expect(data.symptoms).toHaveLength(1);
    expect(typeof data.generatedAt).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/routes/child/[id]/foods/[entryId]/print/page.server.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the loader**

Create `src/routes/child/[id]/foods/[entryId]/print/+page.server.ts`:

```ts
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { children, foodEntries, foods } from '$lib/server/db/schema';
import { listSymptomsByEntry } from '$lib/server/db/symptoms';
import { requireUser, assertChildAccess } from '$lib/server/guards';
import { ageInMonths } from '$lib/utils/age';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  const user = requireUser(locals);
  const childId = Number(params.id);
  const entryId = Number(params.entryId);
  await assertChildAccess(user.id, childId);

  const row = (
    await db
      .select({
        childName: children.name,
        birthDate: children.birthDate,
        foodName: foods.name,
        givenAt: foodEntries.givenAt,
        reaction: foodEntries.reaction
      })
      .from(foodEntries)
      .innerJoin(foods, eq(foods.id, foodEntries.foodId))
      .innerJoin(children, eq(children.id, foodEntries.childId))
      .where(and(eq(foodEntries.id, entryId), eq(foodEntries.childId, childId)))
      .limit(1)
  )[0];
  if (!row) throw error(404, 'Food entry not found');

  const symptoms = await listSymptomsByEntry(entryId);
  const locale = (locals.locale ?? 'fr') as 'fr' | 'en';
  const dtf = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'long',
    timeStyle: 'short'
  });

  return {
    childName: row.childName,
    months: ageInMonths(row.birthDate),
    foodName: row.foodName,
    reaction: row.reaction,
    givenAt: dtf.format(row.givenAt),
    symptoms: symptoms.map((s) => ({
      label: s.label,
      observedAt: dtf.format(s.observedAt),
      note: s.note
    })),
    generatedAt: dtf.format(new Date())
  };
};
```

Create `src/routes/child/[id]/foods/[entryId]/print/+page.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { severityOf, type SymptomLabel } from '$lib/content/symptoms';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function severityLabel(label: SymptomLabel): string {
    const s = severityOf(label);
    if (s === 'severe') return m.printSeveritySevere();
    if (s === 'warn') return m.printSeverityWarn();
    return m.printSeverityNeutral();
  }

  function symptomLabelText(l: SymptomLabel): string {
    const key = `symptomsLabel${l
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')}` as
      | 'symptomsLabelRougeur'
      | 'symptomsLabelUrticaire'
      | 'symptomsLabelEczema'
      | 'symptomsLabelVomissement'
      | 'symptomsLabelDiarrhee'
      | 'symptomsLabelGonflement'
      | 'symptomsLabelToux'
      | 'symptomsLabelDetresseRespiratoire'
      | 'symptomsLabelLevresBleues'
      | 'symptomsLabelAutre';
    return m[key]();
  }
</script>

<svelte:head>
  <title>{m.printDocumentTitle()}</title>
</svelte:head>

<style>
  :global(body) {
    background: white;
    color: black;
    font-family: ui-sans-serif, system-ui, sans-serif;
    margin: 0;
    padding: 24px;
    max-width: 720px;
  }
  h1 {
    font-size: 20px;
    margin: 0 0 8px 0;
  }
  h2 {
    font-size: 14px;
    margin: 24px 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th,
  td {
    border-bottom: 1px solid #ddd;
    padding: 6px 4px;
    text-align: left;
  }
  footer {
    margin-top: 32px;
    font-size: 12px;
    color: #555;
  }
  @media print {
    :global(body) {
      padding: 0;
    }
  }
</style>

<h1>{m.printDocumentTitle()}</h1>
<p>{m.printChildHeader({ name: data.childName, months: String(data.months) })}</p>

<h2>{m.printFoodSection()}</h2>
<p>{data.foodName} — {data.givenAt} ({data.reaction})</p>

<h2>{m.printSymptomsSection()}</h2>
{#if data.symptoms.length === 0}
  <p>—</p>
{:else}
  <table>
    <thead>
      <tr>
        <th>Heure</th>
        <th>Symptôme</th>
        <th>Note</th>
        <th>Sévérité</th>
      </tr>
    </thead>
    <tbody>
      {#each data.symptoms as s, i (i)}
        <tr>
          <td>{s.observedAt}</td>
          <td>{symptomLabelText(s.label)}</td>
          <td>{s.note ?? ''}</td>
          <td>{severityLabel(s.label)}</td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<footer>
  <p>{m.printFooterNote()}</p>
  <p>{m.printGeneratedAt({ date: data.generatedAt })}</p>
</footer>
```

- [ ] **Step 4: Run tests + commit**

Run: `npx vitest run src/routes/child/[id]/foods/[entryId]/print/page.server.test.ts`
Expected: PASS

```bash
git add src/routes/child/[id]/foods/[entryId]/print/
git commit -m "feat(reaction): /print server-rendered HTML for pediatrician export"
```

---

### Task 30: Add `id="reactions"` anchor on GuideStaticSections

**Files:**

- Modify: `src/lib/components/GuideStaticSections.svelte`

- [ ] **Step 1: Find the red-flags section (or equivalent reactions section)**

Open the file. Find the existing static section that describes red-flags / reactions (likely a `<section>` element with a heading mentioning réactions). If none exists, add a new minimal section near the bottom:

```svelte
<section id="reactions" class="scroll-mt-6 space-y-3">
  <h2 class="text-xl font-semibold">Réactions</h2>
  <p class="text-sm text-foreground/90">
    Une réaction localisée se résout souvent seule. Surveillez 30 minutes. En cas de difficulté
    à respirer, gonflement du visage ou lèvres bleues, appelez le 15 immédiatement.
  </p>
</section>
```

If a red-flags section already exists, just add `id="reactions"` and `class="scroll-mt-6"` to its outer element.

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/GuideStaticSections.svelte
git commit -m "feat(guide): add #reactions anchor for stay-cool card link target"
```

---

### Task 31: Wire DiscoverBento into /child/[id]/guide

**Files:**

- Modify: `src/routes/child/[id]/guide/+page.server.ts`
- Modify: `src/routes/child/[id]/guide/+page.svelte`

- [ ] **Step 1: Extend the loader**

Replace `src/routes/child/[id]/guide/+page.server.ts` with:

```ts
import { ageInMonths } from '$lib/utils/age';
import { getStageForAgeMonths, getAllStagesForBento } from '$lib/content/guidance';
import { chooseSuggestedFoods } from '$lib/utils/suggest';
import { db } from '$lib/server/db';
import { foodEntries, foods, tipDismissals } from '$lib/server/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { isBentoEnabled } from '$lib/feature-flags';
import { requireUser } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, cookies }) => {
  const { child } = await parent();
  const user = requireUser(locals);
  const months = ageInMonths(child.birthDate);
  const currentStageId = getStageForAgeMonths(months).id;

  if (!isBentoEnabled(user, cookies)) {
    return { ageMonths: months, currentStageId, bento: false as const };
  }

  const stages = getAllStagesForBento();
  const recent = await db
    .select({
      foodId: foodEntries.foodId,
      foodName: foods.name,
      category: foods.category,
      givenAt: foodEntries.givenAt
    })
    .from(foodEntries)
    .innerJoin(foods, eq(foods.id, foodEntries.foodId))
    .where(eq(foodEntries.childId, child.id))
    .orderBy(desc(foodEntries.givenAt))
    .limit(20);
  const recentMs = recent.map((r) => ({ ...r, givenAt: r.givenAt.getTime() }));

  const todayKey = new Date().toISOString().slice(0, 10);
  const dismissedToday = (
    await db
      .select()
      .from(tipDismissals)
      .where(and(eq(tipDismissals.userId, user.id), eq(tipDismissals.dismissedOnKey, todayKey)))
  ).map((d) => d.tipId);

  return {
    ageMonths: months,
    currentStageId,
    bento: true as const,
    stages,
    suggestions: chooseSuggestedFoods({
      starterFoods: [],
      recent: recentMs,
      priorityAllergensTodo: [],
      now: Date.now(),
      count: 5
    }),
    todayTip:
      dismissedToday.length === 0
        ? {
            id: 'tip-allergen-eggs',
            title: "Introduire l'œuf tôt",
            body: "LEAP recommande l'introduction de l'œuf entre 4 et 11 mois."
          }
        : null,
    tipDismissed: dismissedToday.length > 0
  };
};
```

> **Note:** `getAllStagesForBento`, `isBentoEnabled`, `tipDismissals` columns — verify their exact signatures. If `getAllStagesForBento` doesn't exist, add it to `guidance.ts` as a thin wrapper returning the four stages from existing data. If `tipDismissals` schema differs, adapt the where clause.

- [ ] **Step 2: Swap the body of the page Svelte**

Replace `src/routes/child/[id]/guide/+page.svelte` with:

```svelte
<script lang="ts">
  import DiscoverBento from '$lib/components/bento/DiscoverBento.svelte';
  import LegacyGuide from '$lib/components/LegacyGuide.svelte';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

{#if data.bento}
  <DiscoverBento
    stages={data.stages}
    activeStageId={data.currentStageId}
    suggestions={data.suggestions}
    todayTip={data.todayTip}
    tipDismissed={data.tipDismissed}
    onPickSuggestion={(food) => goto(`/child/${$page.params.id}?suggested=${food.id}`)}
    onDismissTip={(id) => {
      const fd = new FormData();
      fd.append('tipId', id);
      fetch('/api/tips/dismiss', { method: 'POST', body: fd });
    }}
  />
{:else}
  <LegacyGuide {data} />
{/if}
```

> **Note:** the legacy guide page is large (~150 lines). Extract it to `src/lib/components/LegacyGuide.svelte` to keep this file slim — or inline the existing guide content guarded by `{:else}`. Either is fine; pick whichever changes fewer existing tests.

- [ ] **Step 3: Run unit tests + commit**

Run: `npm run check && npx vitest run src/routes/child/[id]/guide/`
Expected: PASS

```bash
git add src/routes/child/[id]/guide/
git commit -m "feat(bento): wire DiscoverBento into /child/[id]/guide behind flag"
```

---

### Task 32: Wire ProfilBento into /account

**Files:**

- Modify: `src/routes/account/+page.server.ts`
- Modify: `src/routes/account/+page.svelte`

- [ ] **Step 1: Extend the loader**

In `src/routes/account/+page.server.ts`, after the existing `requireUser` line, add:

```ts
import { isBentoEnabled } from '$lib/feature-flags';
import { db } from '$lib/server/db';
import { children, memberships, users } from '$lib/server/db/schema';
import { ageInMonths } from '$lib/utils/age';
import { eq } from 'drizzle-orm';
```

And replace the body of `load` with:

```ts
export const load: PageServerLoad = async ({ locals, cookies }) => {
  const user = requireUser(locals);
  const passkeysList = (await listPasskeys(user.id)).map(publicPasskey);

  if (!isBentoEnabled(user, cookies)) {
    return { passkeys: passkeysList, bento: false as const };
  }

  // load children + per-child coparents
  const myChildrenRaw = await db
    .select({
      id: children.id,
      name: children.name,
      birthDate: children.birthDate
    })
    .from(children)
    .innerJoin(memberships, eq(memberships.childId, children.id))
    .where(eq(memberships.userId, user.id));

  const childrenWithCoparents = await Promise.all(
    myChildrenRaw.map(async (c) => {
      const cps = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          role: memberships.role
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.childId, c.id));
      return {
        id: String(c.id),
        name: c.name,
        ageMonths: ageInMonths(c.birthDate),
        coparents: cps
          .filter((cp) => cp.id !== user.id)
          .map((cp) => ({
            id: String(cp.id),
            displayName: cp.displayName ?? `Utilisateur #${cp.id}`,
            role: cp.role
          }))
      };
    })
  );

  return {
    passkeys: passkeysList,
    bento: true as const,
    children: childrenWithCoparents,
    locale: (locals.locale ?? 'fr') as 'fr' | 'en',
    theme: 'system' as const
  };
};
```

- [ ] **Step 2: Swap the body of the page Svelte**

Wrap the existing /account body in `{#if data.bento} <ProfilBento ... /> {:else} <existing legacy markup> {/if}`. The legacy markup stays unchanged.

```svelte
<script lang="ts">
  import ProfilBento from '$lib/components/bento/ProfilBento.svelte';
  // existing imports kept
  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

{#if data.bento}
  <ProfilBento
    children={data.children}
    passkeyCount={data.passkeys.length}
    locale={data.locale}
    theme={data.theme}
  />
{:else}
  <!-- existing legacy markup unchanged -->
{/if}
```

- [ ] **Step 3: Run tests + commit**

Run: `npm run check && npx vitest run src/routes/account/`
Expected: PASS

```bash
git add src/routes/account/+page.server.ts src/routes/account/+page.svelte
git commit -m "feat(bento): wire ProfilBento into /account behind flag"
```

---

### Task 33: Link reaction-detail from FoodCard, RecentFeed, and ReminderStrip

**Files:**

- Modify: `src/lib/components/bento/FoodCard.svelte`
- Modify: `src/lib/components/bento/RecentFeed.svelte`
- Modify: `src/routes/child/[id]/+page.server.ts`

- [ ] **Step 1: Wrap non-RAS FoodCard in an `<a>`**

In `FoodCard.svelte`, accept a new `href` prop. When `status !== 'todo'` AND `status !== 'ras'` (the entry has a non-RAS reaction), the card becomes a link; otherwise it stays a static article.

The relevant FoodCard prop change:

```svelte
<script lang="ts">
  // ...existing imports
  type Status = 'ras' | 'inconfort' | 'reaction' | 'todo';
  let {
    name,
    category,
    tried,
    status,
    href
  }: { name: string; category: string; tried: number; status: Status; href?: string } = $props();
  const isUntried = $derived(tried === 0);
  const isLinkable = $derived(status === 'inconfort' || status === 'reaction');
</script>

{#if isLinkable && href}
  <a
    {href}
    class={cn(
      'flex flex-col gap-1 rounded-tile bg-canvas p-3 shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]',
      'border border-border/40'
    )}
    data-category={category}
    data-status={status}
  >
    <p class="text-sm font-bold leading-tight">{name}</p>
    <p class="text-xs text-ink-soft">
      {isUntried ? m.carnetFoodCardUntried() : m.carnetFoodCardTried({ count: String(tried) })}
    </p>
  </a>
{:else}
  <article
    class={cn(
      'flex flex-col gap-1 rounded-tile bg-canvas p-3 shadow-soft',
      isUntried ? 'border border-dashed border-border' : 'border border-border/40'
    )}
    data-category={category}
    data-status={status}
  >
    <p class="text-sm font-bold leading-tight">{name}</p>
    <p class="text-xs text-ink-soft">
      {isUntried ? m.carnetFoodCardUntried() : m.carnetFoodCardTried({ count: String(tried) })}
    </p>
  </article>
{/if}
```

Update callers in `FoodCardGrid.svelte` / `CarnetTous.svelte` to pass the `href` when the item has a non-RAS reaction:

```svelte
<FoodCard
  name={f.name}
  category={f.category}
  tried={f.tried}
  status={f.status}
  href={f.status === 'inconfort' || f.status === 'reaction'
    ? `/child/${childId}/foods/${f.lastEntryId}`
    : undefined}
/>
```

This requires the Carnet loader to provide `lastEntryId` per food. Extend the loader appropriately.

- [ ] **Step 2: Wrap non-RAS RecentFeed rows in `<a>`**

In `RecentFeed.svelte`, the `<li>` for entries with `reaction !== 'ras'` becomes a link to `/child/{childId}/foods/{entry.id}`. Add a `childId` prop.

- [ ] **Step 3: Wire reminder CTA href**

In `src/routes/child/[id]/+page.server.ts`, the existing reminder builder constructs `reminders[].cta.href`. Update it so when the reminder is the 48-hour observation reminder, `href` is `/child/${child.id}/foods/${latestNonRasEntryId}`. Find the latest non-RAS entry within the past 48 hours; if none, leave the reminder with its existing href.

- [ ] **Step 4: Run tests + commit**

Run: `npm run check && npx vitest run`
Expected: PASS — tests for `FoodCard.test.ts`, `RecentFeed.test.ts`, `CarnetTous.test.ts` may need an `href` / `childId` prop update.

```bash
git add src/lib/components/bento/FoodCard.svelte src/lib/components/bento/RecentFeed.svelte src/lib/components/bento/FoodCardGrid.svelte src/lib/components/bento/CarnetTous.svelte src/routes/child/[id]/+page.server.ts
git commit -m "feat(bento): link non-RAS food entries to reaction-detail page"
```

---

### Task 34: E2E spec — Découvrir

**Files:**

- Create: `e2e/bento-discover.spec.ts`

- [ ] **Step 1: Write the e2e spec**

Create `e2e/bento-discover.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { signInAsOwner } from './helpers/auth';

test.use({ viewport: { width: 414, height: 896 } });

test('Découvrir bento renders all four sections + a stage Sheet opens', async ({ page }) => {
  await signInAsOwner(page);
  await page.context().addCookies([{ name: 'bento', value: '1', url: page.url() }]);
  await page.goto('/child/1/guide');
  await expect(page.getByText('Les étapes')).toBeVisible();
  await expect(page.getByText('Suggestions du jour')).toBeVisible();
  await expect(page.getByText('Sources scientifiques')).toBeVisible();

  await page.getByRole('button', { name: /6 à 9 mois/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
});
```

> **Note:** `signInAsOwner` is the existing test helper used by other e2e specs (`e2e/bento-shell.spec.ts` etc.). Confirm its name; adapt if different.

- [ ] **Step 2: Run the spec + commit**

Run: `npx playwright test e2e/bento-discover.spec.ts`
Expected: PASS

```bash
git add e2e/bento-discover.spec.ts
git commit -m "test(e2e): Découvrir bento renders + stage Sheet opens"
```

---

### Task 35: E2E spec — Profil

**Files:**

- Create: `e2e/bento-profil.spec.ts`

- [ ] **Step 1: Write the e2e spec**

```ts
import { test, expect } from '@playwright/test';
import { signInAsOwner } from './helpers/auth';

test.use({ viewport: { width: 414, height: 896 } });

test('Profil bento renders all sections', async ({ page }) => {
  await signInAsOwner(page);
  await page.context().addCookies([{ name: 'bento', value: '1', url: page.url() }]);
  await page.goto('/account');
  await expect(page.getByText('Vos enfants')).toBeVisible();
  await expect(page.getByText('Compte')).toBeVisible();
  await expect(page.getByText('Vos données (RGPD)')).toBeVisible();
  await expect(page.getByText('Légal')).toBeVisible();
});
```

- [ ] **Step 2: Run the spec + commit**

Run: `npx playwright test e2e/bento-profil.spec.ts`
Expected: PASS

```bash
git add e2e/bento-profil.spec.ts
git commit -m "test(e2e): Profil bento renders all five sections"
```

---

### Task 36: E2E spec — Reaction detail + print

**Files:**

- Create: `e2e/bento-reaction-detail.spec.ts`

- [ ] **Step 1: Write the e2e spec**

```ts
import { test, expect } from '@playwright/test';
import { signInAsOwner, seedNonRasFoodEntry } from './helpers/auth';

test.use({ viewport: { width: 414, height: 896 } });

test('reaction-detail page shows hero, severe rail, and timer; add symptom flow works', async ({
  page
}) => {
  await signInAsOwner(page);
  const entryId = await seedNonRasFoodEntry({ food: 'Poire' });
  await page.context().addCookies([{ name: 'bento', value: '1', url: page.url() }]);
  await page.goto(`/child/1/foods/${entryId}`);
  await expect(page.getByText(/On vous accompagne/)).toBeVisible();
  await expect(page.getByText(/Difficulté à respirer/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Suivre 30 min/ })).toBeVisible();

  await page.getByRole('button', { name: 'Ajouter un symptôme' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByLabel(/Symptôme/i)
    .getByText('Rougeur')
    .click();
  await page.getByRole('button', { name: 'Enregistrer le symptôme' }).click();

  await expect(page.getByText('Rougeur')).toBeVisible();
});

test('print page renders without bento chrome and contains key strings', async ({ page }) => {
  await signInAsOwner(page);
  const entryId = await seedNonRasFoodEntry({ food: 'Poire' });
  await page.goto(`/child/1/foods/${entryId}/print`);
  await expect(page.locator('h1')).toContainText(/Diversif/);
  await expect(page.locator('footer')).toContainText(/pédiatre/);
  await expect(page.locator('nav')).toHaveCount(0);
});
```

> **Note:** `seedNonRasFoodEntry` is a new test helper; add it to `e2e/helpers/auth.ts` (or wherever helpers live) calling existing seed helpers via a fixtures endpoint, mirroring the pattern of other e2e specs that need seeded data.

- [ ] **Step 2: Run the spec + commit**

Run: `npx playwright test e2e/bento-reaction-detail.spec.ts`
Expected: PASS

```bash
git add e2e/bento-reaction-detail.spec.ts e2e/helpers/auth.ts
git commit -m "test(e2e): reaction-detail bento + symptom add flow + print page"
```

---

### Task 37: Privacy policy update

**Files:**

- Modify: `src/routes/politique-confidentialite/+page.svelte` (or wherever the privacy text lives — find with `grep -rln "tip_dismissals" src/routes/`)

- [ ] **Step 1: Locate the privacy policy section**

Run: `grep -rn "tip_dismissals" src/routes/politique-confidentialite/`
Find the section listing user-data tables.

- [ ] **Step 2: Add one sentence**

Append to the same data-tables list:

> Les symptômes observés et notes associées sont stockés dans la table `symptoms` et supprimés en cascade lors de la suppression du compte ou de l'enfant.

(EN locale variant if the file is locale-split.)

- [ ] **Step 3: Commit**

```bash
git add src/routes/politique-confidentialite/
git commit -m "docs(privacy): list symptoms table in user-data section"
```

---

## Self-review summary

After all 37 tasks land, the following gates must be green:

- `npm run check` — typecheck clean.
- `npx vitest run` — every test passes, no uncaught errors.
- `npm run test:coverage` — 100% coverage across all touched files.
- `npx playwright test` — all e2e specs pass at mobile viewport.
- `npm run lint` — clean (pre-commit hook will catch most issues).

Each task is committable in isolation. The feature flag keeps every surface dark for non-allow-listed users until Phase 7 cleanup.
