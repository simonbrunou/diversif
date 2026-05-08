// The 12 allergens diversif tracks for the diversification logbook,
// derived from EU Regulation 1169/2011 Annexe II (14 allergens for
// food labelling) minus two:
//   - lupin: rarely encountered in unprocessed home cooking.
//   - sulphites: a preservative, not a food group; mostly in dried
//     fruit and wine — out of scope for infant diversification.
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

export function getAllergenLabel(id: string | null | undefined): string | null {
  if (!id) return null;
  return ALLERGENS.find((a) => a.id === id)?.label ?? null;
}
