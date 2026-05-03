export const CATEGORIES = [
  { id: 'legumes', label: 'Légumes' },
  { id: 'fruits', label: 'Fruits' },
  { id: 'feculents', label: 'Féculents' },
  { id: 'legumineuses', label: 'Légumineuses' },
  { id: 'viandes', label: 'Viandes' },
  { id: 'poissons', label: 'Poissons' },
  { id: 'oeufs', label: 'Œufs' },
  { id: 'produits_laitiers', label: 'Produits laitiers' },
  { id: 'allergenes', label: 'Allergènes (à introduire tôt)' },
  { id: 'matieres_grasses', label: 'Matières grasses' },
  { id: 'aromates', label: 'Aromates' },
  { id: 'autre', label: 'Autre' }
] as const;

export type CategoryId = (typeof CATEGORIES)[number]['id'];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as readonly string[];

export function getCategoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
