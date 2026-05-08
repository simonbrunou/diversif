import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { foods } from './schema';
import type * as schema from './schema';

type SeedFood = {
  name: string;
  category: string;
  age: number;
  allergen?: string;
};

export const FOODS_SEED: SeedFood[] = [
  // Légumes
  { name: 'Carotte', category: 'legumes', age: 4 },
  { name: 'Courgette (épluchée, épépinée)', category: 'legumes', age: 4 },
  { name: 'Patate douce', category: 'legumes', age: 4 },
  { name: 'Potiron', category: 'legumes', age: 4 },
  { name: 'Courge butternut', category: 'legumes', age: 4 },
  { name: 'Panais', category: 'legumes', age: 4 },
  { name: 'Haricot vert', category: 'legumes', age: 5 },
  { name: 'Brocoli', category: 'legumes', age: 6 },
  { name: 'Chou-fleur', category: 'legumes', age: 6 },
  { name: 'Épinard', category: 'legumes', age: 6 },
  { name: 'Blette', category: 'legumes', age: 6 },
  { name: 'Petit pois', category: 'legumes', age: 6 },
  { name: 'Poireau', category: 'legumes', age: 6 },
  { name: 'Aubergine', category: 'legumes', age: 7 },
  { name: 'Tomate', category: 'legumes', age: 8 },
  { name: 'Poivron', category: 'legumes', age: 9 },
  { name: 'Fenouil', category: 'legumes', age: 6 },
  { name: 'Betterave', category: 'legumes', age: 6 },
  { name: 'Navet', category: 'legumes', age: 6 },
  { name: 'Pomme de terre', category: 'legumes', age: 4 },
  { name: 'Concombre', category: 'legumes', age: 9 },
  { name: 'Artichaut (cœur)', category: 'legumes', age: 9 },
  { name: 'Céleri-rave', category: 'legumes', age: 6, allergen: 'celeri' },
  { name: 'Topinambour', category: 'legumes', age: 8 },
  { name: 'Salade verte', category: 'legumes', age: 9 },

  // Fruits
  { name: 'Pomme', category: 'fruits', age: 4 },
  { name: 'Poire', category: 'fruits', age: 4 },
  { name: 'Banane', category: 'fruits', age: 4 },
  { name: 'Pêche', category: 'fruits', age: 5 },
  { name: 'Abricot', category: 'fruits', age: 5 },
  { name: 'Prune', category: 'fruits', age: 6 },
  { name: 'Mangue', category: 'fruits', age: 6 },
  { name: 'Avocat', category: 'fruits', age: 4 },
  { name: 'Fraise', category: 'fruits', age: 6 },
  { name: 'Framboise', category: 'fruits', age: 6 },
  { name: 'Myrtille', category: 'fruits', age: 6 },
  { name: 'Mûre', category: 'fruits', age: 6 },
  { name: 'Cassis', category: 'fruits', age: 8 },
  { name: 'Kiwi', category: 'fruits', age: 8 },
  { name: 'Raisin (coupé en 4)', category: 'fruits', age: 9 },
  { name: 'Melon', category: 'fruits', age: 6 },
  { name: 'Pastèque', category: 'fruits', age: 8 },
  { name: 'Orange', category: 'fruits', age: 8 },
  { name: 'Clémentine', category: 'fruits', age: 8 },
  { name: 'Ananas', category: 'fruits', age: 9 },

  // Féculents
  { name: 'Riz', category: 'feculents', age: 4 },
  { name: 'Pâtes (blé)', category: 'feculents', age: 6, allergen: 'gluten' },
  { name: 'Semoule de blé', category: 'feculents', age: 6, allergen: 'gluten' },
  { name: 'Pain', category: 'feculents', age: 6, allergen: 'gluten' },
  { name: 'Quinoa', category: 'feculents', age: 6 },
  { name: 'Polenta', category: 'feculents', age: 6 },
  { name: 'Sarrasin', category: 'feculents', age: 6 },
  { name: 'Avoine', category: 'feculents', age: 6, allergen: 'gluten' },
  { name: 'Boulgour', category: 'feculents', age: 8, allergen: 'gluten' },

  // Légumineuses
  { name: 'Lentilles', category: 'legumineuses', age: 6 },
  { name: 'Pois chiches', category: 'legumineuses', age: 6 },
  { name: 'Haricots blancs', category: 'legumineuses', age: 8 },
  { name: 'Haricots rouges', category: 'legumineuses', age: 8 },
  { name: 'Tofu', category: 'legumineuses', age: 36, allergen: 'soja' },

  // Viandes
  { name: 'Poulet', category: 'viandes', age: 6 },
  { name: 'Dinde', category: 'viandes', age: 6 },
  { name: 'Bœuf', category: 'viandes', age: 6 },
  { name: 'Veau', category: 'viandes', age: 6 },
  { name: 'Agneau', category: 'viandes', age: 6 },
  { name: 'Porc', category: 'viandes', age: 6 },
  { name: 'Jambon blanc', category: 'viandes', age: 6 },
  { name: 'Lapin', category: 'viandes', age: 6 },

  // Poissons
  { name: 'Cabillaud', category: 'poissons', age: 6, allergen: 'poisson' },
  { name: 'Saumon', category: 'poissons', age: 6, allergen: 'poisson' },
  { name: 'Sole', category: 'poissons', age: 6, allergen: 'poisson' },
  { name: 'Merlu', category: 'poissons', age: 6, allergen: 'poisson' },
  { name: 'Sardine', category: 'poissons', age: 6, allergen: 'poisson' },
  { name: 'Maquereau', category: 'poissons', age: 6, allergen: 'poisson' },
  { name: 'Truite', category: 'poissons', age: 6, allergen: 'poisson' },

  // Œufs
  { name: 'Œuf entier (bien cuit)', category: 'oeufs', age: 6, allergen: 'oeuf' },
  { name: "Jaune d'œuf", category: 'oeufs', age: 6, allergen: 'oeuf' },

  // Produits laitiers
  { name: 'Yaourt nature', category: 'produits_laitiers', age: 6, allergen: 'lait' },
  { name: 'Fromage blanc', category: 'produits_laitiers', age: 6, allergen: 'lait' },
  { name: 'Petit-suisse', category: 'produits_laitiers', age: 6, allergen: 'lait' },
  { name: 'Camembert', category: 'produits_laitiers', age: 8, allergen: 'lait' },
  { name: 'Comté', category: 'produits_laitiers', age: 8, allergen: 'lait' },
  { name: 'Emmental', category: 'produits_laitiers', age: 8, allergen: 'lait' },
  { name: 'Chèvre frais', category: 'produits_laitiers', age: 8, allergen: 'lait' },
  { name: 'Brebis (fromage)', category: 'produits_laitiers', age: 8, allergen: 'lait' },
  { name: 'Beurre', category: 'produits_laitiers', age: 6, allergen: 'lait' },

  // Allergènes à introduire tôt
  { name: 'Beurre de cacahuète (lisse)', category: 'allergenes', age: 6, allergen: 'arachide' },
  { name: "Purée d'amande", category: 'allergenes', age: 6, allergen: 'fruits_a_coque' },
  { name: 'Purée de noisette', category: 'allergenes', age: 6, allergen: 'fruits_a_coque' },
  { name: 'Purée de noix de cajou', category: 'allergenes', age: 6, allergen: 'fruits_a_coque' },
  { name: 'Tahin (sésame)', category: 'allergenes', age: 6, allergen: 'sesame' },

  // Matières grasses
  { name: "Huile d'olive", category: 'matieres_grasses', age: 4 },
  { name: 'Huile de colza', category: 'matieres_grasses', age: 4 },
  { name: 'Huile de noix', category: 'matieres_grasses', age: 6, allergen: 'fruits_a_coque' },

  // Aromates
  { name: 'Persil', category: 'aromates', age: 6 },
  { name: 'Basilic', category: 'aromates', age: 6 },
  { name: 'Ciboulette', category: 'aromates', age: 6 },
  { name: 'Coriandre', category: 'aromates', age: 6 },
  { name: 'Menthe', category: 'aromates', age: 6 },
  { name: 'Thym', category: 'aromates', age: 6 },
  { name: 'Cumin', category: 'aromates', age: 6 },
  { name: 'Curcuma', category: 'aromates', age: 6 },
  { name: 'Cannelle', category: 'aromates', age: 6 },
  { name: 'Paprika doux', category: 'aromates', age: 6 }
];

export async function seedFoods(db: NodePgDatabase<typeof schema>): Promise<void> {
  const existing = await db.execute<{ count: string }>(
    sql`SELECT COUNT(*)::text as count FROM foods`
  );
  const count = Number(existing.rows[0]?.count ?? 0);
  if (count > 0) return;

  const rows = FOODS_SEED.map((f) => ({
    name: f.name,
    category: f.category,
    isMajorAllergen: f.allergen != null,
    allergenType: f.allergen ?? null,
    suggestedAgeMonths: f.age,
    notes: null,
    isCustom: false,
    customForChildId: null
  }));

  await db.insert(foods).values(rows);
}
