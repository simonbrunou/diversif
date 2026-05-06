// The 12 priority allergens for early-introduction guidance per the HCSP-2020
// avis on infant feeding. EU Regulation 1169/2011 declares 14 allergens for
// food labelling (these 12 plus lupin and sulphites/SO₂), but those two are
// excluded here intentionally:
//   - lupin: not a relevant introduction-window allergen for French infants
//     and rarely encountered in unprocessed home cooking.
//   - sulphites: a preservative, not a primary infant-diversification food
//     group. Threshold is 10 mg/kg, mostly found in dried fruit and wine —
//     out of scope for "what to feed my 6-month-old".
// If diversif ever expands beyond the diversification window or starts
// generating ingredient labels, this list will need to expand to the EU 14.
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
