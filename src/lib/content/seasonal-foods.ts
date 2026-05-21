// Month → list of in-season food names for France.
//
// Names MUST match the seeded foods catalog (`src/lib/server/db/seed.ts`) byte
// for byte, including parentheticals like "Courgette (épluchée, épépinée)" and
// "Raisin (coupé en 4)". Mismatches are silently dropped by the
// `inArray(foods.name, names)` filter in `loadSeasonalFoods`.
//
// Sources used to assemble the lists:
//   - Calendrier des fruits et légumes de saison (Ministère de l'Agriculture, France)
//   - Interfel (Association interprofessionnelle des fruits et légumes frais)
//
// Foods with strict age cutoffs (e.g. miel after 1 an) are still allowed here —
// the server filter also gates by `suggestedAgeMonths` against the child's age.
//
// Items real-world seasonal in France but absent from the current seed
// (Asperge, Cerise, Mâche, Endive, Mandarine, Rhubarbe, Radis, Figue, Chou) are
// not listed here. Adding them needs a seed expansion + migration, tracked
// separately.

export const SEASONAL_FOODS_BY_MONTH: Readonly<Record<number, readonly string[]>> = {
  1: [
    'Poireau',
    'Brocoli',
    'Chou-fleur',
    'Navet',
    'Patate douce',
    'Topinambour',
    'Panais',
    'Courge butternut',
    'Potiron',
    'Pomme',
    'Poire',
    'Orange',
    'Clémentine',
    'Kiwi',
    'Banane'
  ],
  2: [
    'Poireau',
    'Brocoli',
    'Chou-fleur',
    'Navet',
    'Topinambour',
    'Patate douce',
    'Panais',
    'Céleri-rave',
    'Pomme',
    'Poire',
    'Orange',
    'Clémentine',
    'Kiwi',
    'Banane'
  ],
  3: ['Épinard', 'Carotte', 'Petit pois', 'Poireau', 'Pomme', 'Poire', 'Banane', 'Kiwi', 'Orange'],
  4: ['Épinard', 'Petit pois', 'Carotte', 'Salade verte', 'Pomme', 'Banane', 'Kiwi'],
  5: ['Petit pois', 'Fraise', 'Carotte', 'Épinard', 'Salade verte', 'Tomate', 'Concombre'],
  6: [
    'Fraise',
    'Framboise',
    'Abricot',
    'Tomate',
    'Courgette (épluchée, épépinée)',
    'Aubergine',
    'Poivron',
    'Concombre',
    'Melon',
    'Pastèque',
    'Haricot vert',
    'Salade verte'
  ],
  7: [
    'Tomate',
    'Courgette (épluchée, épépinée)',
    'Aubergine',
    'Pêche',
    'Abricot',
    'Melon',
    'Pastèque',
    'Framboise',
    'Haricot vert',
    'Poivron',
    'Concombre',
    'Mûre',
    'Myrtille'
  ],
  8: [
    'Tomate',
    'Courgette (épluchée, épépinée)',
    'Aubergine',
    'Pêche',
    'Prune',
    'Raisin (coupé en 4)',
    'Melon',
    'Pastèque',
    'Framboise',
    'Mûre',
    'Myrtille',
    'Mangue'
  ],
  9: [
    'Raisin (coupé en 4)',
    'Prune',
    'Pêche',
    'Tomate',
    'Aubergine',
    'Courge butternut',
    'Potiron',
    'Pomme',
    'Poire',
    'Carotte'
  ],
  10: [
    'Courge butternut',
    'Potiron',
    'Raisin (coupé en 4)',
    'Pomme',
    'Poire',
    'Brocoli',
    'Chou-fleur',
    'Carotte',
    'Topinambour',
    'Patate douce',
    'Panais'
  ],
  11: [
    'Poireau',
    'Courge butternut',
    'Potiron',
    'Pomme',
    'Poire',
    'Kiwi',
    'Topinambour',
    'Patate douce',
    'Navet',
    'Panais',
    'Céleri-rave'
  ],
  12: [
    'Poireau',
    'Orange',
    'Clémentine',
    'Kiwi',
    'Pomme',
    'Poire',
    'Brocoli',
    'Chou-fleur',
    'Patate douce',
    'Topinambour',
    'Courge butternut',
    'Potiron',
    'Navet'
  ]
} as const;

export function getSeasonalNames(month: number): readonly string[] {
  /* v8 ignore next : month is always 1-12 from getUTCMonth() + 1 */
  return SEASONAL_FOODS_BY_MONTH[month] ?? [];
}
