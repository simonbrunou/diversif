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
  { id: 'gluten', label: 'Gluten' },
  { id: 'oeuf', label: 'Œuf' },
  { id: 'lait', label: 'Lait' },
  { id: 'arachide', label: 'Arachide' },
  { id: 'fruits_a_coque', label: 'Fruits à coque' },
  { id: 'sesame', label: 'Sésame' },
  { id: 'soja', label: 'Soja' },
  { id: 'poisson', label: 'Poisson' },
  { id: 'crustace', label: 'Crustacés' },
  { id: 'mollusque', label: 'Mollusques' },
  { id: 'celeri', label: 'Céleri' },
  { id: 'moutarde', label: 'Moutarde' }
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

export type PriorityIntroductionAllergenId = (typeof PRIORITY_INTRODUCTION_ALLERGENS)[number];

export function getAllergenLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return ALLERGENS.find((a) => a.id === id)?.label ?? null;
}
