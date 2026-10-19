import type { toast as Toast } from 'svelte-sonner';
import { ALLERGENS, getAllergenLabel } from '#lib/utils/allergens.js';
import { TRACKED_CATEGORY_COUNT } from '#lib/utils/categories.js';
import * as m from '#lib/paraglide/messages.js';

const TOAST_CLASS = 'bg-celebrate/15 border-celebrate/30 text-celebrate-foreground';

// Plus "every category" (totalCategories), checked in pickMilestoneFromQuery.
// A fixed 12 here was unreachable: the count excludes 'autre' and tops out at 11.
const CATEGORY_THRESHOLDS = [5, 8] as const;

/**
 * What logging one repas changed for the child, measured by the repas write
 * module (src/lib/server/repas) inside the create transaction.
 */
export type Milestones = {
  /** The child had no repas before this one. */
  firstFood: boolean;
  /** A priority allergen this repas introduced for the first time, if any. */
  firstAllergen: string | null;
  /** This repas completed the full allergen list. */
  allAllergens: boolean;
  /** Food categories covered (excluding `autre`) before and after the repas. */
  categories: { before: number; after: number };
};

export type MilestoneKind =
  | { kind: 'all-allergens' }
  | { kind: 'first-allergen'; allergenType: string }
  | { kind: 'first-food' }
  | { kind: 'category-milestone'; covered: number; total: number }
  | { kind: 'generic' };

// The milestones travel to the dashboard in the post-log redirect query:
//   ?logged=1[&first=1][&allergen=arachide][&allAllergens=1]&categories=N&prevCategories=M
// The encoder and the decoder below are the only code that knows these names.
const MILESTONE_PARAMS = [
  'logged',
  'first',
  'allergen',
  'allAllergens',
  'categories',
  'prevCategories'
] as const;

/**
 * Encode milestones as the post-log query string. The decoder reads params by
 * name, but redirects stored in idempotency_keys before a deploy replay
 * verbatim, so the names are a contract: renaming one breaks those replays.
 */
function milestonesQuery(milestones: Milestones): string {
  const search = new URLSearchParams({ logged: '1' });
  if (milestones.firstFood) search.set('first', '1');
  if (milestones.firstAllergen) search.set('allergen', milestones.firstAllergen);
  if (milestones.allAllergens) search.set('allAllergens', '1');
  search.set('categories', String(milestones.categories.after));
  search.set('prevCategories', String(milestones.categories.before));
  return search.toString();
}

/** The (unlocalized) dashboard path a new repas lands on, carrying its milestones. */
export function milestonesPath(childId: number, milestones: Milestones): string {
  return `/child/${childId}?${milestonesQuery(milestones)}`;
}

/** Strip the milestone params once celebrated, so a reload doesn't toast again. */
export function clearMilestoneQuery(url: URL): void {
  for (const key of MILESTONE_PARAMS) url.searchParams.delete(key);
}

/**
 * Decide which (if any) milestone to celebrate from the redirect query string
 * built by milestonesQuery, picking the highest-impact one.
 */
export function pickMilestoneFromQuery(
  search: Pick<URLSearchParams, 'get'>,
  totalCategories: number
): MilestoneKind | null {
  if (search.get('logged') !== '1') return null;

  // Highest-impact celebration first.
  if (search.get('allAllergens') === '1') return { kind: 'all-allergens' };

  const allergen = search.get('allergen');
  if (allergen) return { kind: 'first-allergen', allergenType: allergen };

  if (search.get('first') === '1') return { kind: 'first-food' };

  const covered = Number(search.get('categories'));
  const prev = Number(search.get('prevCategories'));
  if (Number.isFinite(covered) && Number.isFinite(prev) && covered > prev) {
    if (
      covered >= totalCategories ||
      CATEGORY_THRESHOLDS.includes(covered as (typeof CATEGORY_THRESHOLDS)[number])
    ) {
      return { kind: 'category-milestone', covered, total: totalCategories };
    }
  }

  return { kind: 'generic' };
}

export function celebrate(toast: typeof Toast, milestone: MilestoneKind): void {
  switch (milestone.kind) {
    case 'all-allergens':
      toast.success(m.milestoneAllAllergensTitle({ count: ALLERGENS.length }), {
        description: m.milestoneAllAllergensDescription(),
        class: TOAST_CLASS
      });
      return;
    case 'first-food':
      toast.success(m.milestoneFirstFoodTitle(), {
        description: m.milestoneFirstFoodDescription(),
        class: TOAST_CLASS
      });
      return;
    case 'first-allergen':
      toast.success(
        m.milestoneFirstAllergenTitle({
          allergen: getAllergenLabel(milestone.allergenType) ?? milestone.allergenType
        }),
        {
          description: m.milestoneFirstAllergenDescription(),
          class: TOAST_CLASS
        }
      );
      return;
    case 'category-milestone':
      if (milestone.covered >= milestone.total) {
        toast.success(m.milestoneAllCategoriesTitle(), {
          class: TOAST_CLASS
        });
      } else {
        toast.success(m.milestoneCategoryTitle({ covered: milestone.covered }), {
          description: m.milestoneCategoryDescription({
            remaining: milestone.total - milestone.covered
          }),
          class: TOAST_CLASS
        });
      }
      return;
    case 'generic':
      toast.success(m.milestoneGenericTitle());
      return;
  }
}

/**
 * Toasts for the queued repas one queue flush replayed: one per milestone
 * reached, else a single plain "synced" toast. Each entry of `queryStrings` is
 * a replay redirect's query string, the flags the dashboard reads after an
 * online log. One toast per repas would bury a milestone under the others.
 */
export function celebrateSynced(toast: typeof Toast, queryStrings: readonly string[]): void {
  let celebrated = false;
  for (const qs of queryStrings) {
    const milestone = pickMilestoneFromQuery(new URLSearchParams(qs), TRACKED_CATEGORY_COUNT);
    if (milestone && milestone.kind !== 'generic') {
      celebrate(toast, milestone);
      celebrated = true;
    }
  }
  if (!celebrated) toast.success(m.offlineSyncedToast());
}
