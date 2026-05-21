// Month → list of in-season food names for France.
//
// Names are matched against the seeded foods catalog (`src/lib/server/db/seed.ts`).
// Capitalisation and accents must match the seed exactly: e.g. `Châtaigne` not
// `châtaigne`, `Œuf` not `Oeuf`. If a name is not in the seed, it is silently
// dropped at the query layer (we filter by `inArray(foods.name, names)`).
//
// Sources used to assemble the lists:
//   - Calendrier des fruits et légumes de saison (Ministère de l'Agriculture, France)
//   - Interfel (Association interprofessionnelle des fruits et légumes frais)
//
// Foods with strict age cutoffs (e.g. miel after 1 an, fruits secs entiers after 4 ans)
// are still allowed here — the server pass also filters by `suggestedAgeMonths`
// against the child's age.

export const SEASONAL_FOODS_BY_MONTH: Readonly<Record<number, readonly string[]>> = {
  1: ['Poireau', 'Mâche', 'Endive', 'Orange', 'Kiwi', 'Pomme', 'Poire', 'Banane'],
  2: ['Poireau', 'Chou', 'Navet', 'Orange', 'Clémentine', 'Pomme', 'Kiwi'],
  3: ['Épinard', 'Asperge', 'Radis', 'Banane', 'Kiwi', 'Pomme'],
  4: ['Asperge', 'Radis', 'Épinard', 'Salade', 'Rhubarbe'],
  5: ['Asperge', 'Petit pois', 'Fraise', 'Rhubarbe', 'Salade', 'Cerise'],
  6: ['Fraise', 'Cerise', 'Abricot', 'Courgette', 'Tomate', 'Haricot vert', 'Melon'],
  7: ['Tomate', 'Courgette', 'Aubergine', 'Abricot', 'Pêche', 'Melon', 'Framboise', 'Haricot vert'],
  8: ['Tomate', 'Courgette', 'Aubergine', 'Pêche', 'Prune', 'Raisin', 'Melon', 'Framboise'],
  9: ['Raisin', 'Prune', 'Figue', 'Pêche', 'Tomate', 'Aubergine', 'Courge', 'Mâche'],
  10: ['Courge', 'Butternut', 'Raisin', 'Pomme', 'Poire', 'Brocoli', 'Chou-fleur'],
  11: ['Poireau', 'Endive', 'Courge', 'Pomme', 'Poire', 'Mandarine', 'Kiwi'],
  12: ['Poireau', 'Endive', 'Mâche', 'Orange', 'Clémentine', 'Kiwi', 'Pomme', 'Mandarine']
} as const;

export function getSeasonalNames(month: number): readonly string[] {
  /* v8 ignore next : month is always 1-12 from getUTCMonth() + 1 */
  return SEASONAL_FOODS_BY_MONTH[month] ?? [];
}
