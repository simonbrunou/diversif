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
// User-facing copy resolves through paraglide so the EN locale gets English
// reminders. Since the paraglide-js 2.x migration, hooks.server.ts wraps the
// request in paraglideMiddleware's AsyncLocalStorage scope, so every m.X()
// call below resolves the request's own locale — the old setLanguageTag
// module-global race (concurrent requests cross-contaminating SSR output) is
// gone.
import * as m from '$lib/paraglide/messages';
import type { SourceId } from '$lib/content/sources';
import { FORBIDDEN_FOODS } from '$lib/content/guidance';
import type { EnrichedEntry } from './queries';
import { findRepeatCandidates } from './repeat-candidates';

type Severity = 'info' | 'warn' | 'important';

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

// Shared inputs threaded through every rule. `now` and `childPath` are derived
// once so each rule stays a pure function of the child's data.
type RuleContext = { input: ReminderInput; now: number; childPath: string };

// A "rule" maps the child's data to zero or more candidate reminders. They run
// in array order; computeReminders then drops dismissed keys, sorts by severity
// and caps the list. Each rule owns exactly one numbered block from the spec.
const RULES: ReadonlyArray<(ctx: RuleContext) => Reminder[]> = [
  ruleWelcome,
  ruleStageTransitions,
  ruleStaleDiversity,
  rulePendingAllergens,
  ruleHighRiskWindow,
  ruleRepeatExposure,
  ruleCategoryImbalance,
  ruleForbiddenFoods,
  ruleMaintainAllergens
];

export function computeReminders(input: ReminderInput): Reminder[] {
  const ctx: RuleContext = {
    input,
    now: input.now ?? Date.now(),
    childPath: `/child/${input.childId}`
  };
  const out: Reminder[] = [];
  for (const rule of RULES) {
    for (const reminder of rule(ctx)) push(out, input.dismissals, reminder);
  }
  // Sort by severity, cap to top 4 to avoid noise
  out.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
  return out.slice(0, 4);
}

// 1. Welcome : child created < 7 days ago AND 0 entries
function ruleWelcome({ input, now, childPath }: RuleContext): Reminder[] {
  const childAgeDays = Math.floor((now - input.childCreatedAt) / DAY_MS);
  if (input.entries.length !== 0 || childAgeDays >= 7) return [];
  return [
    {
      key: 'welcome',
      severity: 'important',
      title: m.reminderWelcomeTitle(),
      body: m.reminderWelcomeBody(),
      cta: { label: m.reminderCtaReadGuide(), href: `${childPath}/guide` },
      sources: ['spf-pnns-guide', 'hcsp-2020'],
      dismissable: false
    }
  ];
}

// 2. Stage transitions
function ruleStageTransitions({ input, childPath }: RuleContext): Reminder[] {
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
      title: m.reminderStage6Title(),
      body: m.reminderStage6Body(),
      sources: ['hcsp-2020', 'espghan-2017']
    },
    {
      months: 9,
      key: 'stage-transition:9m',
      title: m.reminderStage9Title(),
      body: m.reminderStage9Body(),
      sources: ['spf-pnns-guide']
    },
    {
      months: 12,
      key: 'stage-transition:12m',
      title: m.reminderStage12Title(),
      body: m.reminderStage12Body(),
      sources: ['spf-pnns-guide', 'hcsp-2020']
    }
  ];
  return stageTransitions
    .filter((st) => input.ageMonths >= st.months && input.ageMonths < st.months + 2)
    .map(
      (st): Reminder => ({
        key: st.key,
        severity: 'important',
        title: st.title,
        body: st.body,
        cta: { label: m.reminderCtaSeeGuide(), href: `${childPath}/guide` },
        sources: st.sources,
        dismissable: true
      })
    );
}

// 3. Stale diversity : no *new* food in 14 days (and child has any entries)
function ruleStaleDiversity({ input, now, childPath }: RuleContext): Reminder[] {
  if (input.entries.length === 0 || input.ageMonths < 4) return [];
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
  if (newestFirstIntro <= 0 || daysSinceNewFood < 14) return [];
  return [
    {
      key: 'stale-diversity',
      severity: 'info',
      title: m.reminderStaleDiversityTitle({ days: daysSinceNewFood }),
      body: m.reminderStaleDiversityBody(),
      cta: { label: m.reminderCtaSeeSuggestions(), href: `${childPath}/suggestions` },
      sources: ['spf-pnns-guide'],
      dismissable: true
    }
  ];
}

// 4. Pending allergens : age >= 6 mo and allergen not yet introduced
function rulePendingAllergens({ input, childPath }: RuleContext): Reminder[] {
  if (input.ageMonths < 6) return [];
  const missing = ALLERGEN_PRIORITY.filter((id) => !input.introducedAllergens.has(id));
  return missing.slice(0, 3).map(
    (id): Reminder => ({
      key: `pending-allergen:${id}`,
      severity: 'warn',
      title: m.reminderPendingAllergenTitle({ allergen: getAllergenLabel(id) }),
      body: m.reminderPendingAllergenBody(),
      cta: { label: m.reminderCtaHowToIntroduce(), href: `${childPath}/guide#allergenes` },
      sources: ['leap-2015', 'eat-2016', 'espghan-2017'],
      dismissable: true
    })
  );
}

// 5. High-risk window 4-11 mo with no priority allergen introduced.
// Note: gates on the priority subset, not the full ALLERGENS set:
// logging a log-completeness allergen (céleri, moutarde, crustacés,
// mollusques) or soja shouldn't suppress the LEAP/EAT framing, since
// those weren't covered by either trial.
function ruleHighRiskWindow({ input, childPath }: RuleContext): Reminder[] {
  const priorityIntroduced = PRIORITY_INTRODUCTION_ALLERGENS.some((id) =>
    input.introducedAllergens.has(id)
  );
  if (
    input.ageMonths < 4 ||
    input.ageMonths > 11 ||
    priorityIntroduced ||
    input.entries.length === 0
  ) {
    return [];
  }
  return [
    {
      key: 'high-risk-window',
      severity: 'warn',
      title: m.reminderHighRiskWindowTitle(),
      body: m.reminderHighRiskWindowBody(),
      cta: { label: m.reminderCtaReadGuide(), href: `${childPath}/guide#allergenes` },
      sources: ['leap-2015', 'eat-2016'],
      dismissable: true
    }
  ];
}

// 6. Repeat exposure : food given exactly 1× with reaction ras|inconfort,
// > 3 days ago, and not a priority allergen (rule 9 owns those). Stricter
// than the broad "1-2× & worst<=1" predicate used by the carnet's repeat
// filter and loadDiversityMetrics; both share findRepeatCandidates as the
// canonical predicate engine, with reminders narrowing it further via the
// maxCount=1 + minDaysSinceLastGiven + excludeAllergens options.
function ruleRepeatExposure({ input, now, childPath }: RuleContext): Reminder[] {
  const repeatCandidates = findRepeatCandidates(input.entries, {
    maxCount: 1,
    minDaysSinceLastGiven: 3,
    excludeAllergens: new Set<AllergenId>(ALLERGEN_PRIORITY),
    now
  });
  repeatCandidates.sort((a, b) => a.lastGivenAt - b.lastGivenAt);
  return repeatCandidates.slice(0, 2).map(
    (c): Reminder => ({
      key: `repeat-exposure:${c.foodId}`,
      severity: 'info',
      title: m.reminderRepeatExposureTitle({ food: c.foodName }),
      body: m.reminderRepeatExposureBody(),
      cta: { label: m.reminderCtaLogThisFood(), href: `${childPath}/log?foodId=${c.foodId}` },
      sources: ['spf-pnns-guide'],
      dismissable: true
    })
  );
}

// 7. Category imbalance : last 14 days dominated by 1 category > 60 %
function ruleCategoryImbalance({ input, now, childPath }: RuleContext): Reminder[] {
  if (input.entries.length < 5) return [];
  const since = now - 14 * DAY_MS;
  const last14 = input.entries.filter((e) => e.givenAt >= since);
  if (last14.length < 5) return [];
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
  if (!dominant) return [];
  return [
    {
      key: `category-imbalance:${dominant.cat}`,
      severity: 'info',
      title: m.reminderCategoryImbalanceTitle(),
      body: m.reminderCategoryImbalanceBody({
        percent: Math.round(dominant.ratio * 100),
        category: getCategoryLabel(dominant.cat)
      }),
      cta: { label: m.reminderCtaSeeSuggestions(), href: `${childPath}/suggestions` },
      sources: ['spf-pnns-guide'],
      dismissable: true
    }
  ];
}

// 8. Forbidden food matched in entries (e.g., custom food named "Miel"
// before 12 mo). Iterates FORBIDDEN_FOODS so the age gate + name pattern
// come from a single source; an item must set ALL of `untilMonths`,
// `nameMatchers` (non-empty), and `reminderTitle` to surface as a runtime
// reminder. Other forbidden items (sel, sucre, lait-cru, …) are
// ingredient-level and aren't catalog-detectable; the guide page surfaces
// them statically.
function ruleForbiddenFoods({ input }: RuleContext): Reminder[] {
  const out: Reminder[] = [];
  for (const food of FORBIDDEN_FOODS) {
    if (food.untilMonths == null || !food.nameMatchers?.length || !food.reminderTitle) continue;
    if (input.ageMonths >= food.untilMonths) continue;
    const lcMatchers = food.nameMatchers.map((matcher) => matcher.toLowerCase());
    const match = input.entries.find((e) => {
      const lc = e.foodName.toLowerCase();
      return lcMatchers.some((matcher) => lc.includes(matcher));
    });
    if (!match) continue;
    // First matcher is conventionally the canonical name token (e.g. 'miel').
    const token = food.nameMatchers[0];
    out.push({
      key: `forbidden-reminder:${food.id}`,
      severity: 'important',
      title: food.reminderTitle,
      body: m.reminderForbiddenBody({ token, reason: food.reason }),
      sources: food.sources,
      dismissable: true
    });
  }
  return out;
}

// 9. Maintain priority allergens: once a priority allergen has been
// introduced, surface a calm nudge if more than four days have passed
// since the last exposure. Anchored to the LEAP/ESPGHAN target of
// 2-3 times per week. Reaction-bearing allergens are suppressed here so
// we never compete with the reaction surfaces.
type MaintainCandidate = { id: AllergenId; daysSince: number; lastAt: number };

// Per priority allergen: newest exposure timestamp, and whether any exposure
// triggered a frank reaction (a reaction suppresses the maintain nudge so we
// never compete with the reaction surfaces).
function summarizePriorityAllergens(entries: EnrichedEntry[]): {
  lastByAllergen: Map<AllergenId, number>;
  hasReactionByAllergen: Map<AllergenId, boolean>;
} {
  const lastByAllergen = new Map<AllergenId, number>();
  const hasReactionByAllergen = new Map<AllergenId, boolean>();
  for (const e of entries) {
    if (!e.allergenType) continue;
    const aid = e.allergenType as AllergenId;
    if (!ALLERGEN_PRIORITY.includes(aid)) continue;
    const cur = lastByAllergen.get(aid);
    if (cur == null || e.givenAt > cur) lastByAllergen.set(aid, e.givenAt);
    if (e.reaction === 'reaction') hasReactionByAllergen.set(aid, true);
  }
  return { lastByAllergen, hasReactionByAllergen };
}

// Introduced, reaction-free priority allergens whose last exposure is older than
// the maintain window, sorted oldest exposure first (largest daysSince first).
function selectMaintainCandidates(
  input: ReminderInput,
  now: number,
  lastByAllergen: Map<AllergenId, number>,
  hasReactionByAllergen: Map<AllergenId, boolean>
): MaintainCandidate[] {
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
  candidates.sort((a, b) => b.daysSince - a.daysSince);
  return candidates;
}

function ruleMaintainAllergens({ input, now, childPath }: RuleContext): Reminder[] {
  if (input.ageMonths < 4) return [];
  const { lastByAllergen, hasReactionByAllergen } = summarizePriorityAllergens(input.entries);
  const candidates = selectMaintainCandidates(input, now, lastByAllergen, hasReactionByAllergen);
  // Cap to MAINTAIN_CARD_CAP.
  return candidates.slice(0, MAINTAIN_CARD_CAP).map((c): Reminder => {
    const label = getAllergenLabel(c.id);
    const lastAtDayBucket = Math.floor(c.lastAt / DAY_MS);
    return {
      key: `maintain-allergen:${c.id}:${lastAtDayBucket}`,
      severity: 'info',
      title: m.reminderMaintainAllergenTitle({ allergen: label }),
      body: m.reminderMaintainAllergenBody({
        allergen: label.toLowerCase(),
        days: c.daysSince
      }),
      cta: { label: m.reminderCtaSeeAllergens(), href: `${childPath}/foods?segment=allergens` },
      sources: ['leap-2015', 'espghan-2017', 'anses-nourrisson'],
      dismissable: true
    };
  });
}

function push(out: Reminder[], dismissals: Set<string>, r: Reminder): void {
  if (dismissals.has(r.key)) return;
  out.push(r);
}
