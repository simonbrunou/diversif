import type { toast as Toast } from 'svelte-sonner';
import { ALLERGENS, getAllergenLabel } from '$lib/utils/allergens';
import * as m from '$lib/paraglide/messages';

const TOAST_CLASS = 'bg-celebrate/15 border-celebrate/30 text-celebrate-foreground';

const CATEGORY_THRESHOLDS = [5, 8, 12] as const;

export type MilestoneKind =
  | { kind: 'all-allergens' }
  | { kind: 'first-allergen'; allergenType: string }
  | { kind: 'first-food' }
  | { kind: 'category-milestone'; covered: number; total: number }
  | { kind: 'generic' };

/**
 * Decide which (if any) milestone to celebrate from the redirect query string,
 * picking the highest-impact one. Flags come from the log action:
 *   ?logged=1[&first=1][&allergen=arachide][&allAllergens=1]&categories=N&prevCategories=M
 */
export function pickMilestoneFromQuery(
  search: URLSearchParams,
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
    if (CATEGORY_THRESHOLDS.includes(covered as (typeof CATEGORY_THRESHOLDS)[number])) {
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
