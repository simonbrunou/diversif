// The reminder policy: which cards Aujourd'hui shows, in what order, and how
// long a dismissal holds. Pure: child-history.ts hands the rules the facts it
// derived from its one read, so every rule is testable without a database.

import {
  PRIORITY_INTRODUCTION_ALLERGENS,
  getAllergenLabel,
  type AllergenId
} from '#lib/utils/allergens.js';
import { getCategoryLabel, type CategoryId } from '#lib/utils/categories.js';
// User-facing copy resolves through paraglide so the EN locale gets English
// reminders. Since the paraglide-js 2.x migration, hooks.server.ts wraps the
// request in paraglideMiddleware's AsyncLocalStorage scope, so every m.X()
// call below resolves the request's own locale — the old setLanguageTag
// module-global race (concurrent requests cross-contaminating SSR output) is
// gone.
import * as m from '#lib/paraglide/messages.js';
import type { SourceId } from '#lib/content/sources.js';
import { FORBIDDEN_FOODS } from '#lib/content/guidance.js';
import type { AllergenHistory } from './allergen-history';
import type { FoodHistory, HistoryEntry } from './child-history';

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

/** What the page knows beyond the child's history. */
export type ReminderContext = {
  ageMonths: number;
  childCreatedAt: number;
  /** Keys the viewer dismissed, already expired by their TTL (loadDismissals). */
  dismissals: ReadonlySet<string>;
};

/** The facts child-history.ts derives for the rules, all anchored on `now`. */
export type ReminderInput = ReminderContext & {
  childId: number;
  now: number;
  /** Every entry, newest first. */
  entries: readonly HistoryEntry[];
  /** Every food ever logged. */
  foods: readonly FoodHistory[];
  /** ChildHistory.repeatCandidates. */
  repeatCandidates: readonly FoodHistory[];
  allergens: AllergenHistory;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const OBSERVATION_WINDOW_MS = 48 * 60 * 60 * 1000;
const MAX_CARDS = 4;
const MAINTAIN_CARD_CAP = 2;
const REPEAT_CARD_CAP = 2;
const REPEAT_COOLDOWN_DAYS = 3;

// These are the common allergens French guidance says not to delay. See
// PRIORITY_INTRODUCTION_ALLERGENS for which allergens are in scope and why
// the others (soja, céleri, moutarde, crustacés, mollusques) are excluded.
const ALLERGEN_PRIORITY: readonly AllergenId[] = PRIORITY_INTRODUCTION_ALLERGENS;
const PRIORITY_SET = new Set<string>(ALLERGEN_PRIORITY);

// A rule drafts a family's cards; the family gives each card its key and
// severity. `keySuffix` tells two cards of one family apart.
type Draft = Omit<Reminder, 'key' | 'severity'> & { keySuffix?: string };
type RuleContext = { input: ReminderInput; childPath: string };
type Rule = (ctx: RuleContext) => Draft[];

// Every card family, in the order Aujourd'hui lists them, with its severity
// and the rule that drafts its cards. The severity picks the card's icon
// (ReminderStrip leads with a bell on 'warn') and how long a dismissal holds
// (TTL_BY_SEVERITY), so a family can't be shown at one severity and expire at
// another. Cards run important, then warn, then info, except the observation
// window: a reaction in the last 48 hours leads, whatever its severity.
const FAMILIES = {
  'observation-window': { severity: 'warn', rule: ruleObservationWindow },
  welcome: { severity: 'important', rule: ruleWelcome },
  'stage-transition': { severity: 'important', rule: ruleStageTransitions },
  'forbidden-reminder': { severity: 'important', rule: ruleForbiddenFoods },
  'pending-allergen': { severity: 'warn', rule: rulePendingAllergens },
  'stale-diversity': { severity: 'info', rule: ruleStaleDiversity },
  'repeat-exposure': { severity: 'info', rule: ruleRepeatExposure },
  'category-imbalance': { severity: 'info', rule: ruleCategoryImbalance },
  'maintain-allergen': { severity: 'info', rule: ruleMaintainAllergens }
} as const satisfies Record<string, { severity: Severity; rule: Rule }>;

/** Every card the rules raise, minus the dismissed ones, in display order, 4 at most. */
export function computeReminders(input: ReminderInput): Reminder[] {
  const ctx: RuleContext = { input, childPath: `/child/${input.childId}` };
  const out: Reminder[] = [];
  for (const [family, { severity, rule }] of Object.entries(FAMILIES)) {
    for (const { keySuffix, ...draft } of rule(ctx)) {
      const key = keySuffix === undefined ? family : `${family}:${keySuffix}`;
      if (!input.dismissals.has(key)) out.push({ key, severity, ...draft });
    }
  }
  return out.slice(0, MAX_CARDS);
}

// Observation window: a non-RAS entry in the last 48 hours points the parent
// at that entry's page, to review its notes and symptoms without hunting
// through the log. Only the latest such entry, dismissed or not.
function ruleObservationWindow({ input, childPath }: RuleContext): Draft[] {
  const latest = input.entries.find(
    (e) => e.reaction !== 'ras' && input.now - e.givenAt <= OBSERVATION_WINDOW_MS
  );
  if (!latest) return [];
  return [
    {
      keySuffix: String(latest.id),
      title: m.reminderObservationTitle({ food: latest.foodName }),
      body: m.reminderObservationBody(),
      cta: { label: m.reminderCtaSeeProfile(), href: `${childPath}/foods/${latest.id}` },
      dismissable: true
    }
  ];
}

// Welcome : child created < 7 days ago AND 0 entries
function ruleWelcome({ input, childPath }: RuleContext): Draft[] {
  const childAgeDays = Math.floor((input.now - input.childCreatedAt) / DAY_MS);
  if (input.foods.length !== 0 || childAgeDays >= 7) return [];
  return [
    {
      title: m.reminderWelcomeTitle(),
      body: m.reminderWelcomeBody(),
      cta: { label: m.reminderCtaReadGuide(), href: `${childPath}/guide` },
      sources: ['spf-pnns-guide', 'hcsp-2020'],
      dismissable: false
    }
  ];
}

// Stage transitions
function ruleStageTransitions({ input, childPath }: RuleContext): Draft[] {
  const stageTransitions: Array<{
    months: number;
    title: string;
    body: string;
    sources: SourceId[];
  }> = [
    {
      months: 6,
      title: m.reminderStage6Title(),
      body: m.reminderStage6Body(),
      sources: ['hcsp-2020', 'espghan-2017']
    },
    {
      months: 9,
      title: m.reminderStage9Title(),
      body: m.reminderStage9Body(),
      sources: ['spf-pnns-guide']
    },
    {
      months: 12,
      title: m.reminderStage12Title(),
      body: m.reminderStage12Body(),
      sources: ['spf-pnns-guide', 'hcsp-2020']
    }
  ];
  return stageTransitions
    .filter((st) => input.ageMonths >= st.months && input.ageMonths < st.months + 2)
    .map((st): Draft => ({
      keySuffix: `${st.months}m`,
      title: st.title,
      body: st.body,
      cta: { label: m.reminderCtaSeeGuide(), href: `${childPath}/guide` },
      sources: st.sources,
      dismissable: true
    }));
}

// Stale diversity : no *new* food in 14 days (and child has any entries). A
// food is new on its first entry, so a repeat of an old food doesn't count.
function ruleStaleDiversity({ input, childPath }: RuleContext): Draft[] {
  if (input.foods.length === 0 || input.ageMonths < 4) return [];
  const lastNewFoodAt = input.foods.reduce((acc, f) => Math.max(acc, f.firstAt), -Infinity);
  const daysSinceNewFood = Math.floor((input.now - lastNewFoodAt) / DAY_MS);
  if (daysSinceNewFood < 14) return [];
  return [
    {
      title: m.reminderStaleDiversityTitle({ days: daysSinceNewFood }),
      body: m.reminderStaleDiversityBody(),
      cta: { label: m.reminderCtaSeeSuggestions(), href: `${childPath}/suggestions` },
      sources: ['spf-pnns-guide'],
      dismissable: true
    }
  ];
}

// Pending allergens: once diversification has started, allergen not yet introduced
function rulePendingAllergens({ input, childPath }: RuleContext): Draft[] {
  if (input.ageMonths < 4 || input.foods.length === 0) return [];
  const missing = ALLERGEN_PRIORITY.filter((id) => !input.allergens.isIntroduced(id));
  return missing.slice(0, 3).map((id): Draft => ({
    keySuffix: id,
    title: m.reminderPendingAllergenTitle({ allergen: getAllergenLabel(id) }),
    body: m.reminderPendingAllergenBody(),
    cta: { label: m.reminderCtaHowToIntroduce(), href: `${childPath}/guide#allergenes` },
    sources: ['hcsp-2020', 'eaaci-2020'],
    dismissable: true
  }));
}

// Repeat exposure: the repeat candidates given exactly once, more than 3 days
// ago, the 2 longest unseen. Stricter than the Carnet's filter, which lists
// every candidate. Priority allergens are left to ruleMaintainAllergens, and a
// food whose allergen is blocked by symptoms on another food is dropped (#373).
function ruleRepeatExposure({ input, childPath }: RuleContext): Draft[] {
  const { now, allergens } = input;
  return input.repeatCandidates
    .filter(
      (c) =>
        c.count === 1 &&
        now - c.lastAt > REPEAT_COOLDOWN_DAYS * DAY_MS &&
        !(
          c.allergenType &&
          (PRIORITY_SET.has(c.allergenType) || allergens.isBlocked(c.allergenType))
        )
    )
    .slice(0, REPEAT_CARD_CAP)
    .map((c): Draft => ({
      keySuffix: String(c.foodId),
      title: m.reminderRepeatExposureTitle({ food: c.foodName }),
      body: m.reminderRepeatExposureBody(),
      cta: { label: m.reminderCtaLogThisFood(), href: `${childPath}/log?foodId=${c.foodId}` },
      sources: ['spf-pnns-guide'],
      dismissable: true
    }));
}

// Category imbalance : last 14 days dominated by 1 category > 60 %
function ruleCategoryImbalance({ input, childPath }: RuleContext): Draft[] {
  if (input.entries.length < 5) return [];
  const since = input.now - 14 * DAY_MS;
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
      keySuffix: dominant.cat,
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

// Forbidden food matched among the foods logged (e.g., custom food named
// "Miel" before 12 mo). Iterates FORBIDDEN_FOODS so the age gate + name
// pattern come from a single source; an item must set ALL of `untilMonths`,
// `nameMatchers` (non-empty), and `reminderTitle` to surface as a runtime
// reminder. Other forbidden items (sel, sucre, lait-cru, …) are
// ingredient-level and aren't catalog-detectable; the guide page surfaces
// them statically.
function ruleForbiddenFoods({ input }: RuleContext): Draft[] {
  const out: Draft[] = [];
  for (const food of FORBIDDEN_FOODS) {
    if (food.untilMonths == null || !food.nameMatchers?.length || !food.reminderTitle) continue;
    if (input.ageMonths >= food.untilMonths) continue;
    const lcMatchers = food.nameMatchers.map((matcher) => matcher.toLowerCase());
    const match = input.foods.some((f) => {
      const lc = f.foodName.toLowerCase();
      return lcMatchers.some((matcher) => lc.includes(matcher));
    });
    if (!match) continue;
    // First matcher is conventionally the canonical name token (e.g. 'miel').
    const token = food.nameMatchers[0];
    out.push({
      keySuffix: food.id,
      title: food.reminderTitle,
      body: m.reminderForbiddenBody({ token, reason: food.reason }),
      sources: food.sources,
      dismissable: true
    });
  }
  return out;
}

// Maintain priority allergens: nudge the first MAINTAIN_CARD_CAP overdue
// entries of the allergen history's maintain queue, the same queue the menu's
// maintenance card and the 'fading' state read. The queue never holds an
// allergen associated with discomfort or a reaction, so this nudge never
// advises re-exposure before medical review.
function ruleMaintainAllergens({ input, childPath }: RuleContext): Draft[] {
  if (input.ageMonths < 4) return [];
  const overdue = input.allergens.maintainQueue.filter((c) => c.overdue);
  return overdue.slice(0, MAINTAIN_CARD_CAP).map((c): Draft => {
    const label = getAllergenLabel(c.id);
    const lastAtDayBucket = Math.floor(c.lastAt / DAY_MS);
    return {
      keySuffix: `${c.id}:${lastAtDayBucket}`,
      title: m.reminderMaintainAllergenTitle({ allergen: label }),
      body: m.reminderMaintainAllergenBody({
        allergen: label.toLowerCase(),
        days: c.daysSince
      }),
      cta: { label: m.reminderCtaSeeAllergens(), href: `${childPath}/foods?segment=allergens` },
      sources: ['ascia-2026'],
      dismissable: true
    };
  });
}

// A dismissed important reminder never comes back.
export const TTL_BY_SEVERITY: Record<Severity, number> = {
  important: Infinity,
  warn: 90 * DAY_MS,
  info: 30 * DAY_MS
};

// A Map, not FAMILIES itself, because the key comes from the client: a key
// like 'constructor' must not resolve to an Object.prototype member. The
// WelcomeDialog's dismissal shares the table but is no card: once closed, it
// stays closed.
const SEVERITY_BY_FAMILY: ReadonlyMap<string, Severity> = new Map([
  ...Object.entries(FAMILIES).map(([family, { severity }]): [string, Severity] => [
    family,
    severity
  ]),
  ['welcome-dialog', 'important']
]);

/**
 * How long a dismissal of this key holds: the TTL of its family's severity,
 * the family being the key up to its first ':'. Unknown families get the info
 * TTL, the shortest.
 */
export function ttlForReminderKey(key: string): number {
  const family = key.split(':', 1)[0];
  return TTL_BY_SEVERITY[SEVERITY_BY_FAMILY.get(family) ?? 'info'];
}
