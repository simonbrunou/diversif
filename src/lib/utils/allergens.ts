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
