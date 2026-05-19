// Pure derivation engine: given the child's data + dismissals, produce the
// list of reminders the dashboard should currently surface. No DB calls here
// : the caller passes plain data : to keep this trivially testable.

import {
  ALLERGEN_MAINTAIN_DAYS,
  PRIORITY_INTRODUCTION_ALLERGENS,
  getAllergenLabel,
  type AllergenId
} from '$lib/utils/allergens';
import { getCategoryLabel, type CategoryId } from '$lib/utils/categories';
import type { SourceId } from '$lib/content/sources';
import { FORBIDDEN_FOODS } from '$lib/content/guidance';
import type { EnrichedEntry } from './queries';
import { findRepeatCandidates } from './repeat-candidates';

export type Severity = 'info' | 'warn' | 'important';

export type Reminder = {
  key: string;
  severity: Severity;
  title: string;
  body: string;
  cta?: { label: string; href: string };
  sources?: SourceId[];
  dismissable: boolean;
};

export type ReminderInput = {
  childId: number;
  ageMonths: number;
  childCreatedAt: number;
  entries: EnrichedEntry[]; // full history, recent first : first-intro and exposure-count rules need it
  introducedAllergens: Set<AllergenId>;
  dismissals: Set<string>; // already-honored TTLs by caller
  now?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// "Plus on attend, plus le risque d'allergie augmente" + LEAP/EAT/ESPGHAN
// sources are only valid for the early-introduction priority set. See
// PRIORITY_INTRODUCTION_ALLERGENS for which allergens are in scope and why
// the others (soja, céleri, moutarde, crustacés, mollusques) are excluded.
const ALLERGEN_PRIORITY: readonly AllergenId[] = PRIORITY_INTRODUCTION_ALLERGENS;

const MAINTAIN_CARD_CAP = 2;

const SEVERITY_RANK: Record<Severity, number> = { important: 0, warn: 1, info: 2 };

export function computeReminders(input: ReminderInput): Reminder[] {
  const now = input.now ?? Date.now();
  const out: Reminder[] = [];
  const childAgeDays = Math.floor((now - input.childCreatedAt) / DAY_MS);
  const childPath = `/child/${input.childId}`;

  // 1. Welcome : child created < 7 days ago AND 0 entries
  if (input.entries.length === 0 && childAgeDays < 7) {
    push(out, input.dismissals, {
      key: 'welcome',
      severity: 'important',
      title: 'Bienvenue sur Diversif',
      body: 'La diversification commence en douceur dès 4 mois révolus. Lisez le guide pour vous repérer puis enregistrez le premier aliment de bébé.',
      cta: { label: 'Lire le guide', href: `${childPath}/guide` },
      sources: ['spf-pnns-guide', 'hcsp-2020'],
      dismissable: false
    });
  }

  // 2. Stage transitions
  const stageTransitions: Array<{
    months: number;
    key: string;
    title: string;
    body: string;
    sources: SourceId[];
  }> = [
    {
      months: 6,
      key: 'stage-transition:6m',
      title: 'Bébé a 6 mois : place aux protéines',
      body: "C'est le moment d'introduire viande, poisson, œuf bien cuit et légumineuses pour le fer. Si ce n'est pas fait, c'est aussi la fenêtre clé pour les allergènes (œuf, arachide, gluten…).",
      sources: ['hcsp-2020', 'espghan-2017']
    },
    {
      months: 9,
      key: 'stage-transition:9m',
      title: 'Bébé a 9 mois : premiers morceaux',
      body: "Bébé pince entre pouce et index. Proposez des bâtonnets de légumes cuits, des lamelles d'avocat, des pâtes bien cuites. Toujours sous surveillance.",
      sources: ['spf-pnns-guide']
    },
    {
      months: 12,
      key: 'stage-transition:12m',
      title: 'Bébé a 1 an : repas familiaux adaptés',
      body: 'Bébé partage progressivement les repas familiaux, en versions adaptées : moins salées, moins sucrées, morceaux découpés. Le lait reste à ~500 mL/jour.',
      sources: ['spf-pnns-guide', 'hcsp-2020']
    }
  ];
  for (const st of stageTransitions) {
    if (input.ageMonths >= st.months && input.ageMonths < st.months + 2) {
      push(out, input.dismissals, {
        key: st.key,
        severity: 'important',
        title: st.title,
        body: st.body,
        cta: { label: 'Voir le guide', href: `${childPath}/guide` },
        sources: st.sources,
        dismissable: true
      });
    }
  }

  // 3. Stale diversity : no *new* food in 14 days (and child has any entries)
  if (input.entries.length > 0 && input.ageMonths >= 4) {
    // newest occurrence per food
    const firstByFood = new Map<number, number>();
    for (const e of input.entries) {
      const cur = firstByFood.get(e.foodId);
      if (cur == null || e.givenAt < cur) firstByFood.set(e.foodId, e.givenAt);
    }
    const newestFirstIntro = Array.from(firstByFood.values()).reduce<number>(
      (acc, v) => (v > acc ? v : acc),
      0
    );
    const daysSinceNewFood = Math.floor((now - newestFirstIntro) / DAY_MS);
    if (newestFirstIntro > 0 && daysSinceNewFood >= 14) {
      push(out, input.dismissals, {
        key: 'stale-diversity',
        severity: 'info',
        title: `Pas de nouveauté depuis ${daysSinceNewFood} jours`,
        body: 'Reprenez le rythme : proposez un aliment encore non testé. La variété entretient la curiosité gustative et la tolérance aux allergènes.',
        cta: { label: 'Voir les suggestions', href: `${childPath}/suggestions` },
        sources: ['spf-pnns-guide'],
        dismissable: true
      });
    }
  }

  // 4. Pending allergens : age >= 6 mo and allergen not yet introduced
  if (input.ageMonths >= 6) {
    const missing = ALLERGEN_PRIORITY.filter((id) => !input.introducedAllergens.has(id));
    for (const id of missing.slice(0, 3)) {
      push(out, input.dismissals, {
        key: `pending-allergen:${id}`,
        severity: 'warn',
        title: `Allergène à introduire : ${getAllergenLabel(id)}`,
        body: "Plus on attend, plus le risque d'allergie augmente. Introduisez-le sous une forme adaptée à l'âge de bébé.",
        cta: { label: "Comment l'introduire", href: `${childPath}/guide#allergenes` },
        sources: ['leap-2015', 'eat-2016', 'espghan-2017'],
        dismissable: true
      });
    }
  }

  // 5. High-risk window 4-11 mo with no priority allergen introduced.
  // Note: gates on the priority subset, not the full ALLERGENS set:
  // logging a log-completeness allergen (céleri, moutarde, crustacés,
  // mollusques) or soja shouldn't suppress the LEAP/EAT framing, since
  // those weren't covered by either trial.
  const priorityIntroduced = PRIORITY_INTRODUCTION_ALLERGENS.some((id) =>
    input.introducedAllergens.has(id)
  );
  if (
    input.ageMonths >= 4 &&
    input.ageMonths <= 11 &&
    !priorityIntroduced &&
    input.entries.length > 0
  ) {
    push(out, input.dismissals, {
      key: 'high-risk-window',
      severity: 'warn',
      title: 'Fenêtre 4–11 mois pour les allergènes',
      body: "C'est la période-clé pour introduire arachide, œuf, lait, gluten… Reculer ne protège pas : au contraire (LEAP, EAT).",
      cta: { label: 'Lire le guide', href: `${childPath}/guide#allergenes` },
      sources: ['leap-2015', 'eat-2016'],
      dismissable: true
    });
  }

  // 6. Repeat exposure : food given exactly 1× with reaction ras|inconfort,
  // > 3 days ago, and not a priority allergen (rule 9 owns those). Stricter
  // than the broad "1-2× & worst<=1" predicate used by the carnet's repeat
  // filter and loadDiversityMetrics; both share findRepeatCandidates as the
  // canonical predicate engine, with reminders narrowing it further via the
  // maxCount=1 + minDaysSinceLastGiven + excludeAllergens options.
  const repeatCandidates = findRepeatCandidates(input.entries, {
    maxCount: 1,
    minDaysSinceLastGiven: 3,
    excludeAllergens: new Set<AllergenId>(ALLERGEN_PRIORITY),
    now
  });
  repeatCandidates.sort((a, b) => a.lastGivenAt - b.lastGivenAt);
  for (const c of repeatCandidates.slice(0, 2)) {
    push(out, input.dismissals, {
      key: `repeat-exposure:${c.foodId}`,
      severity: 'info',
      title: `Reproposez « ${c.foodName} »`,
      body: "L'acceptation gustative se construit avec la répétition : jusqu'à 10 fois pour certains aliments. C'est aussi vrai pour entretenir la tolérance aux allergènes.",
      cta: { label: 'Enregistrer cet aliment', href: `${childPath}/log?foodId=${c.foodId}` },
      sources: ['spf-pnns-guide'],
      dismissable: true
    });
  }

  // 7. Category imbalance : last 14 days dominated by 1 category > 60 %
  if (input.entries.length >= 5) {
    const since = now - 14 * DAY_MS;
    const last14 = input.entries.filter((e) => e.givenAt >= since);
    if (last14.length >= 5) {
      const byCat = new Map<CategoryId, number>();
      for (const e of last14) byCat.set(e.category, (byCat.get(e.category) ?? 0) + 1);
      const total = last14.length;
      let dominant: { cat: CategoryId; ratio: number } | null = null;
      for (const [cat, n] of byCat) {
        const ratio = n / total;
        // The second clause is defensive: at most one category can exceed 60 %
        // of a single sample, but we keep the comparison so the loop is safe
        // if the threshold is ever lowered.
        /* v8 ignore next */
        if (ratio > 0.6 && (!dominant || ratio > dominant.ratio)) {
          dominant = { cat, ratio };
        }
      }
      if (dominant) {
        push(out, input.dismissals, {
          key: `category-imbalance:${dominant.cat}`,
          severity: 'info',
          title: 'Pensez à varier les groupes',
          body: `Plus de ${Math.round(dominant.ratio * 100)} % de vos logs des 14 derniers jours sont dans la catégorie « ${getCategoryLabel(dominant.cat)} ». Diversifiez avec d'autres groupes (protéines, féculents, fruits…).`,
          cta: { label: 'Voir les suggestions', href: `${childPath}/suggestions` },
          sources: ['spf-pnns-guide'],
          dismissable: true
        });
      }
    }
  }

  // 8. Forbidden food matched in entries (e.g., custom food named "Miel"
  // before 12 mo). Iterates FORBIDDEN_FOODS so the age gate + name pattern
  // come from a single source; an item must set ALL of `untilMonths`,
  // `nameMatchers` (non-empty), and `reminderTitle` to surface as a runtime
  // reminder. Other forbidden items (sel, sucre, lait-cru, …) are
  // ingredient-level and aren't catalog-detectable; the guide page surfaces
  // them statically.
  for (const food of FORBIDDEN_FOODS) {
    if (food.untilMonths == null || !food.nameMatchers?.length || !food.reminderTitle) continue;
    if (input.ageMonths >= food.untilMonths) continue;
    const lcMatchers = food.nameMatchers.map((m) => m.toLowerCase());
    const match = input.entries.find((e) => {
      const lc = e.foodName.toLowerCase();
      return lcMatchers.some((m) => lc.includes(m));
    });
    if (!match) continue;
    // First matcher is conventionally the canonical name token (e.g. 'miel').
    const token = food.nameMatchers[0];
    push(out, input.dismissals, {
      key: `forbidden-reminder:${food.id}`,
      severity: 'important',
      title: food.reminderTitle,
      body: `Un aliment enregistré contient « ${token} ». ${food.reason}`,
      sources: food.sources,
      dismissable: true
    });
  }

  // 9. Maintain priority allergens: once a priority allergen has been
  // introduced, surface a calm nudge if more than four days have passed
  // since the last exposure. Anchored to the LEAP/ESPGHAN target of
  // 2-3 times per week. Reaction-bearing allergens are suppressed here so
  // we never compete with the reaction surfaces.
  if (input.ageMonths >= 4) {
    type MaintainCandidate = { id: AllergenId; daysSince: number; lastAt: number };
    const lastByAllergen = new Map<AllergenId, number>();
    const hasReactionByAllergen = new Map<AllergenId, boolean>();
    for (const e of input.entries) {
      if (!e.allergenType) continue;
      const aid = e.allergenType as AllergenId;
      if (!ALLERGEN_PRIORITY.includes(aid)) continue;
      const cur = lastByAllergen.get(aid);
      if (cur == null || e.givenAt > cur) lastByAllergen.set(aid, e.givenAt);
      if (e.reaction === 'reaction') hasReactionByAllergen.set(aid, true);
    }
    const candidates: MaintainCandidate[] = [];
    for (const id of ALLERGEN_PRIORITY) {
      if (!input.introducedAllergens.has(id)) continue;
      if (hasReactionByAllergen.get(id)) continue;
      const lastAt = lastByAllergen.get(id);
      if (lastAt == null) continue; // introduced but no allergenType-tagged entry in window
      const daysSince = Math.max(0, Math.floor((now - lastAt) / DAY_MS));
      if (daysSince > ALLERGEN_MAINTAIN_DAYS) {
        candidates.push({ id, daysSince, lastAt });
      }
    }
    // Sort oldest exposure first (largest daysSince first), cap to MAINTAIN_CARD_CAP.
    candidates.sort((a, b) => b.daysSince - a.daysSince);
    for (const c of candidates.slice(0, MAINTAIN_CARD_CAP)) {
      const label = getAllergenLabel(c.id);
      const lastAtDayBucket = Math.floor(c.lastAt / DAY_MS);
      push(out, input.dismissals, {
        key: `maintain-allergen:${c.id}:${lastAtDayBucket}`,
        severity: 'info',
        title: `Reproposez « ${label} »`,
        body: `Bébé n'a pas eu ${label.toLowerCase()} depuis ${c.daysSince} jours. L'idéal est d'en reproposer 2 à 3 fois par semaine pour entretenir la tolérance.`,
        cta: { label: 'Voir les allergènes', href: `${childPath}/foods?segment=allergens` },
        sources: ['leap-2015', 'espghan-2017', 'anses-nourrisson'],
        dismissable: true
      });
    }
  }

  // Sort by severity, cap to top 4 to avoid noise
  out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return out.slice(0, 4);
}

function push(out: Reminder[], dismissals: Set<string>, r: Reminder): void {
  if (dismissals.has(r.key)) return;
  out.push(r);
}
