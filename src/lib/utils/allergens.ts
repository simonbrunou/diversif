// NOTE: this module is imported by server code (guidance/reminders,
// allergen-status, the report load) and by tests; keep it free of svelte /
// lucide-svelte imports. The paraglide messages import is plain TS and safe.
import * as m from '$lib/paraglide/messages';

// The 12 allergens diversif tracks for the diversification logbook,
// derived from EU Regulation 1169/2011 Annexe II (14 allergens for
// food labelling) minus two:
//   - lupin: rarely encountered in unprocessed home cooking.
//   - sulphites: a preservative, not a food group; mostly in dried
//     fruit and wine : out of scope for infant diversification.
//
// French guidance says not to delay allergenic foods once diversification
// has started; prevention evidence is strongest for well-cooked egg and
// peanut. The other entries here (poisson, sésame,
// soja, céleri, moutarde, crustacés, mollusques) are tracked for
// log-completeness against EU labelling, not because HCSP names them
// as priority introduction allergens.
//
// If diversif ever expands beyond the diversification window or
// starts generating ingredient labels, this list will need to expand
// to the EU 14.
export const ALLERGENS = [
  { id: 'gluten' },
  { id: 'oeuf' },
  { id: 'lait' },
  { id: 'arachide' },
  { id: 'fruits_a_coque' },
  { id: 'sesame' },
  { id: 'soja' },
  { id: 'poisson' },
  { id: 'crustace' },
  { id: 'mollusque' },
  { id: 'celeri' },
  { id: 'moutarde' }
] as const;

export type AllergenId = (typeof ALLERGENS)[number]['id'];

// Common food allergens that French guidance says not to delay once
// diversification has started. Evidence for allergy prevention is not equal
// across this list; it is strongest for well-cooked egg and peanut.
//
// Intentionally absent:
//   - soja: HCSP 2020 + ANSES discourage soja products before 3 ans
//     (phyto-œstrogènes).
//   - céleri, moutarde, crustacés, mollusques: tracked in `ALLERGENS` for
//     log completeness against EU 1169/2011 only : no early-introduction
//     trial covered them, so prompting parents to introduce them with
//     LEAP/EAT/ESPGHAN copy would misattribute the evidence.
export const PRIORITY_INTRODUCTION_ALLERGENS = [
  'oeuf',
  'arachide',
  'lait',
  'gluten',
  'poisson',
  'fruits_a_coque',
  'sesame'
] as const satisfies readonly AllergenId[];

// Days after which a previously-tolerated allergen gets a maintenance nudge.
// Current ASCIA consensus recommends at least weekly exposure. Single source of truth: the dashboard
// `fading` badge in /child/[id]/foods, the `maintain-allergen` reminder
// in lib/server/guidance/reminders, and the `loadAllergenStatus` function
// in lib/server/guidance/allergen-status (powers both the carnet allergens
// row and the Discover passport) all gate on this same threshold.
export const ALLERGEN_MAINTAIN_DAYS = 7;

// Fat products retain their allergen tag for reaction safety, but their
// variable/low protein content does not make them a reliable introduction or
// maintenance exposure. Use the tag for blocking; use this predicate for
// progress, milestones, and automated exposure prompts.
export const ALLERGEN_EXPOSURE_EXCLUDED_CATEGORY = 'matieres_grasses';

export function countsAsAllergenExposure(food: {
  allergenType: string | null | undefined;
  category: string;
}): boolean {
  return food.allergenType != null && food.category !== ALLERGEN_EXPOSURE_EXCLUDED_CATEGORY;
}

// Allergen labels go through paraglide so the EN locale gets English names
// (same pattern as REACTION_LABEL_RESOLVERS in $lib/utils/reactions and
// CATEGORY_LABEL_RESOLVERS in $lib/utils/categories). Adding a new entry to
// ALLERGENS without adding a resolver here is a compile error (the Record is
// keyed on AllergenId), which is the desired loud failure.
// i18n-keep: allergenGluten allergenOeuf allergenLait allergenArachide allergenFruitsACoque allergenSesame allergenSoja allergenPoisson allergenCrustace allergenMollusque allergenCeleri allergenMoutarde
const ALLERGEN_LABEL_RESOLVERS: Record<AllergenId, () => string> = {
  gluten: m.allergenGluten,
  oeuf: m.allergenOeuf,
  lait: m.allergenLait,
  arachide: m.allergenArachide,
  fruits_a_coque: m.allergenFruitsACoque,
  sesame: m.allergenSesame,
  soja: m.allergenSoja,
  poisson: m.allergenPoisson,
  crustace: m.allergenCrustace,
  mollusque: m.allergenMollusque,
  celeri: m.allergenCeleri,
  moutarde: m.allergenMoutarde
};

// Typed overload: when called with a known AllergenId we always return a
// string; the broader signature stays for consumers that pass arbitrary input.
export function getAllergenLabel(id: AllergenId): string;
export function getAllergenLabel(id: string | null | undefined): string | null;
export function getAllergenLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return ALLERGEN_LABEL_RESOLVERS[id as AllergenId]?.() ?? null;
}
