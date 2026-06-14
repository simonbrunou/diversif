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
// HCSP 2020 (avis du 30/06/2020) specifically names produits laitiers,
// œuf, arachide, fruits à coque and gluten as introduction priorities
// in the 4–6 mois window. The other entries here (poisson, sésame,
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

// Allergens for which LEAP (2015), EAT (2016), ESPGHAN 2017 and HCSP 2020
// support early introduction in the 4–11 mo window. Surfacing reminders or
// suggestion-list "à introduire" prompts is only justified for this subset.
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

// Days after which a previously-introduced priority allergen is considered
// "fading" / needs maintenance re-exposure. Anchored to LEAP/ESPGHAN's
// 2-3 exposures/week target. Single source of truth: the dashboard
// `fading` badge in /child/[id]/foods, the `maintain-allergen` reminder
// in lib/server/guidance/reminders, and the `loadAllergenStatus` function
// in lib/server/guidance/allergen-status (powers both the carnet allergens
// row and the Discover passport) all gate on this same threshold.
export const ALLERGEN_MAINTAIN_DAYS = 4;

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
