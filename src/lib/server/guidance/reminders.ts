// Pure derivation engine: given the child's data + dismissals, produce the
// list of reminders the dashboard should currently surface. No DB calls here
// — the caller passes plain data — to keep this trivially testable.

import { ALLERGENS, type AllergenId } from '$lib/utils/allergens';
import type { CategoryId } from '$lib/utils/categories';
import type { ReactionId } from '$lib/utils/reactions';
import type { SourceId } from '$lib/content/sources';
import type { EnrichedEntry } from './queries';

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
  entries: EnrichedEntry[]; // full history, recent first — first-intro and exposure-count rules need it
  introducedAllergens: Set<AllergenId>;
  dismissals: Set<string>; // already-honored TTLs by caller
  now?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Allergens to nag the user about introducing in the 6-mo+ window.
// Soja is intentionally absent: HCSP 2020 and ANSES discourage soja
// products before 3 ans (phyto-œstrogènes), so we don't surface it as
// an "à introduire" reminder.
const ALLERGEN_PRIORITY: AllergenId[] = [
  'oeuf',
  'arachide',
  'lait',
  'gluten',
  'poisson',
  'fruits_a_coque',
  'sesame',
  'celeri',
  'moutarde',
  'crustace',
  'mollusque'
];

const ALLERGEN_LABELS: Record<AllergenId, string> = Object.fromEntries(
  ALLERGENS.map((a) => [a.id, a.label])
) as Record<AllergenId, string>;

const SEVERITY_RANK: Record<Severity, number> = { important: 0, warn: 1, info: 2 };

export function computeReminders(input: ReminderInput): Reminder[] {
  const now = input.now ?? Date.now();
  const out: Reminder[] = [];
  const childAgeDays = Math.floor((now - input.childCreatedAt) / DAY_MS);
  const childPath = `/child/${input.childId}`;

  // 1. Welcome — child created < 7 days ago AND 0 entries
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
      title: 'Bébé a 6 mois — place aux protéines',
      body: "C'est le moment d'introduire viande, poisson, œuf bien cuit et légumineuses pour le fer. Si ce n'est pas fait, c'est aussi la fenêtre clé pour les allergènes (œuf, arachide, gluten…).",
      sources: ['hcsp-2020', 'espghan-2017']
    },
    {
      months: 9,
      key: 'stage-transition:9m',
      title: 'Bébé a 9 mois — premiers morceaux',
      body: "Bébé pince entre pouce et index. Proposez des bâtonnets de légumes cuits, des lamelles d'avocat, des pâtes bien cuites. Toujours sous surveillance.",
      sources: ['spf-pnns-guide']
    },
    {
      months: 12,
      key: 'stage-transition:12m',
      title: 'Bébé a 1 an — repas familiaux adaptés',
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

  // 3. Stale diversity — no *new* food in 14 days (and child has any entries)
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

  // 4. Pending allergens — age >= 6 mo and allergen not yet introduced
  if (input.ageMonths >= 6) {
    const missing = ALLERGEN_PRIORITY.filter((id) => !input.introducedAllergens.has(id));
    for (const id of missing.slice(0, 3)) {
      push(out, input.dismissals, {
        key: `pending-allergen:${id}`,
        severity: 'warn',
        title: `Allergène à introduire : ${ALLERGEN_LABELS[id]}`,
        body: "Plus on attend, plus le risque d'allergie augmente. Introduisez-le sous une forme adaptée à l'âge de bébé.",
        cta: { label: "Comment l'introduire", href: `${childPath}/guide#allergenes` },
        sources: ['leap-2015', 'eat-2016', 'espghan-2017'],
        dismissable: true
      });
    }
  }

  // 5. High-risk window 4-11 mo with no allergen introduced
  if (
    input.ageMonths >= 4 &&
    input.ageMonths <= 11 &&
    input.introducedAllergens.size === 0 &&
    input.entries.length > 0
  ) {
    push(out, input.dismissals, {
      key: 'high-risk-window',
      severity: 'warn',
      title: 'Fenêtre 4–11 mois pour les allergènes',
      body: "C'est la période-clé pour introduire arachide, œuf, lait, gluten… Reculer ne protège pas — au contraire (LEAP, EAT).",
      cta: { label: 'Lire le guide', href: `${childPath}/guide#allergenes` },
      sources: ['leap-2015', 'eat-2016'],
      dismissable: true
    });
  }

  // 6. Repeat exposure — food given 1× with reaction ras|inconfort, > 3 days ago
  type RepeatCandidate = { foodId: number; foodName: string; lastGivenAt: number; count: number };
  const perFood = new Map<
    number,
    { foodName: string; count: number; worstRank: number; lastGivenAt: number }
  >();
  const reactionRank: Record<ReactionId, number> = { ras: 0, inconfort: 1, reaction: 2 };
  for (const e of input.entries) {
    const cur = perFood.get(e.foodId);
    if (!cur) {
      perFood.set(e.foodId, {
        foodName: e.foodName,
        count: 1,
        worstRank: reactionRank[e.reaction],
        lastGivenAt: e.givenAt
      });
    } else {
      cur.count += 1;
      cur.worstRank = Math.max(cur.worstRank, reactionRank[e.reaction]);
      cur.lastGivenAt = Math.max(cur.lastGivenAt, e.givenAt);
    }
  }
  const repeatCandidates: RepeatCandidate[] = [];
  for (const [foodId, v] of perFood) {
    if (v.count === 1 && v.worstRank <= 1 && now - v.lastGivenAt > 3 * DAY_MS) {
      repeatCandidates.push({
        foodId,
        foodName: v.foodName,
        lastGivenAt: v.lastGivenAt,
        count: v.count
      });
    }
  }
  repeatCandidates.sort((a, b) => a.lastGivenAt - b.lastGivenAt);
  for (const c of repeatCandidates.slice(0, 2)) {
    push(out, input.dismissals, {
      key: `repeat-exposure:${c.foodId}`,
      severity: 'info',
      title: `Reproposez « ${c.foodName} »`,
      body: "L'acceptation gustative se construit avec la répétition — jusqu'à 10 fois pour certains aliments. C'est aussi vrai pour entretenir la tolérance aux allergènes.",
      cta: { label: 'Logguer cet aliment', href: `${childPath}/log?foodId=${c.foodId}` },
      sources: ['spf-pnns-guide'],
      dismissable: true
    });
  }

  // 7. Category imbalance — last 14 days dominated by 1 category > 60 %
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
          body: `Plus de ${Math.round(dominant.ratio * 100)} % de vos logs des 14 derniers jours sont dans la catégorie « ${categoryLabel(dominant.cat)} ». Diversifiez avec d'autres groupes (protéines, féculents, fruits…).`,
          cta: { label: 'Voir les suggestions', href: `${childPath}/suggestions` },
          sources: ['spf-pnns-guide'],
          dismissable: true
        });
      }
    }
  }

  // 8. Forbidden food matched in entries (e.g., custom food named "Miel" before 12 mo)
  if (input.ageMonths < 12) {
    const honeyMatch = input.entries.find((e) => /miel/i.test(e.foodName));
    if (honeyMatch) {
      push(out, input.dismissals, {
        key: `forbidden-reminder:miel`,
        severity: 'important',
        title: 'Miel avant 1 an : à éviter',
        body: 'Un aliment loggé contient « miel ». Le miel est déconseillé avant 12 mois (risque de botulisme infantile). Vérifiez et, en cas de doute, contactez votre médecin.',
        sources: ['who-cf', 'anses-nourrisson'],
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

function categoryLabel(id: CategoryId): string {
  // Avoid pulling categories.ts here to keep this module pure-server-friendly.
  const map: Record<CategoryId, string> = {
    legumes: 'Légumes',
    fruits: 'Fruits',
    feculents: 'Féculents',
    legumineuses: 'Légumineuses',
    viandes: 'Viandes',
    poissons: 'Poissons',
    oeufs: 'Œufs',
    produits_laitiers: 'Produits laitiers',
    allergenes: 'Allergènes',
    matieres_grasses: 'Matières grasses',
    aromates: 'Aromates',
    autre: 'Autre'
  };
  return map[id] ?? id;
}
