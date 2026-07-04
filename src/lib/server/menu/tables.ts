import type { CategoryId } from '$lib/utils/categories';
import type { StageId } from '$lib/content/guidance';

export type RoleId =
  | 'legume'
  | 'fruit'
  | 'proteine'
  | 'feculent'
  | 'matiereGrasse'
  | 'laitier'
  | 'dessert';
export type MealId = 'matin' | 'midi' | 'gouter' | 'soir';

// Meal templates by stage. `4-6` and `<4` are handled by the engine's age branch
// (single food / no solids); this table drives 6-9, 9-12, 12-36.
const FULL_DAY: { id: MealId; roles: RoleId[] }[] = [
  { id: 'matin', roles: ['laitier', 'fruit'] },
  { id: 'midi', roles: ['legume', 'proteine', 'feculent', 'matiereGrasse', 'dessert'] },
  { id: 'gouter', roles: ['fruit', 'laitier'] },
  { id: 'soir', roles: ['legume', 'feculent', 'matiereGrasse', 'dessert'] }
];

// Consumed by the meal engine (Task 7); this task only adds the data.
export const MEAL_TEMPLATES: Record<StageId, { id: MealId; roles: RoleId[] }[]> = {
  '4-6': [{ id: 'midi', roles: ['legume'] }], // engine degrades to a single food
  '6-9': FULL_DAY,
  '9-12': FULL_DAY,
  '12-36': FULL_DAY
};

export const ROLE_POOLS: Record<RoleId, CategoryId[]> = {
  legume: ['legumes'],
  fruit: ['fruits'],
  proteine: ['viandes', 'poissons', 'oeufs', 'legumineuses'],
  feculent: ['feculents'],
  matiereGrasse: ['matieres_grasses'],
  laitier: ['produits_laitiers'],
  dessert: ['fruits', 'produits_laitiers']
};

// Monday-origin (index 0 = Monday). Fish twice incl. one oily (index 1).
export const PROTEIN_WEEK: CategoryId[] = [
  'viandes',
  'poissons',
  'legumineuses',
  'oeufs',
  'poissons',
  'viandes',
  'legumineuses'
];
// Consumed by the meal engine (Task 7-9); this task only adds the data.
export const OILY_FISH = ['Saumon', 'Sardine', 'Maquereau', 'Truite'];

// Role-bearing food categories the proactive non-allergen novelty may draw from.
export const NOVELTY_CATEGORIES: CategoryId[] = [
  'legumes',
  'fruits',
  'feculents',
  'legumineuses',
  'viandes',
  'poissons',
  'oeufs',
  'produits_laitiers'
];

// Nut oil is a fruits_a_coque allergen; never rotate it into the silent fat slot.
// Consumed by the meal engine (Task 7-9); this task only adds the data.
export const FAT_EXCLUDE = ['Huile de noix'];

// Charcuterie (salt/processed) stays out of the composable protéine pool at ALL ages.
// Plain "Porc" is a fine cooked protein, so it is NOT here — it's excluded only by the
// `porc` dietary preference (PORC_MATCHERS). Both matchers are consumed by the meal
// engine (Task 7-9); this task only adds the data.
export const CHARCUTERIE_MATCHERS = ['Jambon'];
export const PORC_MATCHERS = ['Porc', 'Jambon']; // the `porc` dietary exclusion

// Soft/fresh cheeses that must carry a pasteurised caveat on the menu. Consumed by
// the meal engine (Task 7-9); this task only adds the data.
export const SOFT_CHEESE = ['Camembert', 'Chèvre frais', 'Brebis (fromage)'];

// Curated seed-name → choking rule. Keys MUST match FOODS_SEED names exactly
// (the CHOKING_HAZARDS keys in guidance.ts do NOT, so we can't string-match).
export const CHOKING_BY_FOOD: Record<string, string> = {
  Tomate: 'Peler et couper en petits morceaux.',
  'Raisin (coupé en 4)': 'Couper en 4 dans la longueur.',
  Carotte: 'Bien cuire jusqu’à fondant ; pas de bâtonnet cru avant 4 ans.',
  Pomme: 'Cuire ou râper finement ; pas de morceau dur cru.',
  Concombre: 'Épépiner et couper en fins bâtonnets tendres.',
  Poivron: 'Peler, cuire, couper fin.',
  'Salade verte': 'Couper très finement.',
  Myrtille: 'Écraser ou couper en deux (baie ronde).',
  Cassis: 'Écraser ou couper en deux (baie ronde).'
};
