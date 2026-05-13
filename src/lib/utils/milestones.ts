import type { toast as Toast } from 'svelte-sonner';
import { ALLERGENS, getAllergenLabel } from '$lib/utils/allergens';

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
      toast.success(
        `Les ${ALLERGENS.length} allergènes prioritaires sont introduits : formidable !`,
        {
          description: 'Maintenez une exposition régulière pour consolider la tolérance.',
          class: TOAST_CLASS
        }
      );
      return;
    case 'first-food':
      toast.success('Premier repas noté : c’est parti !', {
        description: 'Le carnet vit maintenant au rythme de bébé.',
        class: TOAST_CLASS
      });
      return;
    case 'first-allergen':
      toast.success(`${getAllergenLabel(milestone.allergenType)} introduit·e : étape clé !`, {
        description: 'Continuez à reproposer pour consolider la tolérance.',
        class: TOAST_CLASS
      });
      return;
    case 'category-milestone':
      if (milestone.covered >= milestone.total) {
        toast.success('Toutes les familles couvertes : diversité au top !', {
          class: TOAST_CLASS
        });
      } else {
        toast.success(`${milestone.covered} groupes couverts : superbe !`, {
          description: `Plus que ${milestone.total - milestone.covered} pour faire le tour.`,
          class: TOAST_CLASS
        });
      }
      return;
    case 'generic':
      toast.success('C’est noté : bon repas.');
      return;
  }
}
