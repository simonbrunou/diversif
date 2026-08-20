import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import type { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import { sql, count } from 'drizzle-orm';
import { foods } from './schema';
import type * as schema from './schema';
import type { CategoryId } from '$lib/utils/categories';
import type { AllergenId } from '$lib/utils/allergens';

type AnyDb = BunSQLiteDatabase<typeof schema>;
type Tx =
  | AnyDb
  | SQLiteTransaction<'sync', void, typeof schema, ExtractTablesWithRelations<typeof schema>>;

type SeedFood = {
  name: string;
  category: CategoryId;
  age: number;
  allergen?: AllergenId;
};

export const FOODS_SEED: SeedFood[] = [
  // Légumes
  { name: 'Carotte', category: 'legumes', age: 4 },
  { name: 'Courgette (épluchée, épépinée)', category: 'legumes', age: 4 },
  { name: 'Patate douce', category: 'feculents', age: 4 },
  { name: 'Potiron', category: 'legumes', age: 4 },
  { name: 'Courge butternut', category: 'legumes', age: 4 },
  { name: 'Panais', category: 'legumes', age: 4 },
  { name: 'Haricot vert', category: 'legumes', age: 4 },
  { name: 'Brocoli', category: 'legumes', age: 4 },
  { name: 'Chou-fleur', category: 'legumes', age: 4 },
  { name: 'Épinard', category: 'legumes', age: 4 },
  { name: 'Blette', category: 'legumes', age: 4 },
  { name: 'Petit pois', category: 'legumes', age: 4 },
  { name: 'Poireau', category: 'legumes', age: 4 },
  { name: 'Aubergine', category: 'legumes', age: 4 },
  { name: 'Tomate', category: 'legumes', age: 4 },
  { name: 'Poivron', category: 'legumes', age: 4 },
  { name: 'Fenouil', category: 'legumes', age: 4 },
  { name: 'Betterave', category: 'legumes', age: 4 },
  { name: 'Navet', category: 'legumes', age: 4 },
  { name: 'Pomme de terre', category: 'feculents', age: 4 },
  { name: 'Concombre', category: 'legumes', age: 10 },
  { name: 'Artichaut (cœur)', category: 'legumes', age: 4 },
  { name: 'Céleri-rave', category: 'legumes', age: 4, allergen: 'celeri' },
  { name: 'Topinambour', category: 'legumes', age: 4 },
  { name: 'Salade verte', category: 'legumes', age: 10 },

  // Fruits
  { name: 'Pomme', category: 'fruits', age: 4 },
  { name: 'Poire', category: 'fruits', age: 4 },
  { name: 'Banane', category: 'fruits', age: 4 },
  { name: 'Pêche', category: 'fruits', age: 4 },
  { name: 'Abricot', category: 'fruits', age: 4 },
  { name: 'Prune', category: 'fruits', age: 4 },
  { name: 'Mangue', category: 'fruits', age: 4 },
  { name: 'Avocat', category: 'fruits', age: 4 },
  { name: 'Fraise', category: 'fruits', age: 4 },
  { name: 'Framboise', category: 'fruits', age: 4 },
  { name: 'Myrtille', category: 'fruits', age: 4 },
  { name: 'Mûre', category: 'fruits', age: 4 },
  { name: 'Cassis', category: 'fruits', age: 4 },
  { name: 'Kiwi', category: 'fruits', age: 4 },
  { name: 'Raisin (coupé en 4)', category: 'fruits', age: 10 },
  { name: 'Melon', category: 'fruits', age: 4 },
  { name: 'Pastèque', category: 'fruits', age: 4 },
  { name: 'Orange', category: 'fruits', age: 4 },
  { name: 'Clémentine', category: 'fruits', age: 4 },
  { name: 'Ananas', category: 'fruits', age: 4 },

  // Féculents
  { name: 'Riz', category: 'feculents', age: 4 },
  { name: 'Pâtes (blé)', category: 'feculents', age: 4, allergen: 'gluten' },
  { name: 'Semoule de blé', category: 'feculents', age: 4, allergen: 'gluten' },
  { name: 'Pain', category: 'feculents', age: 4, allergen: 'gluten' },
  { name: 'Quinoa', category: 'feculents', age: 4 },
  { name: 'Polenta', category: 'feculents', age: 4 },
  { name: 'Sarrasin', category: 'feculents', age: 4 },
  { name: 'Avoine', category: 'feculents', age: 4, allergen: 'gluten' },
  { name: 'Boulgour', category: 'feculents', age: 4, allergen: 'gluten' },

  // Légumineuses
  { name: 'Lentilles', category: 'legumineuses', age: 4 },
  { name: 'Pois chiches', category: 'legumineuses', age: 4 },
  { name: 'Haricots blancs', category: 'legumineuses', age: 4 },
  { name: 'Haricots rouges', category: 'legumineuses', age: 4 },
  { name: 'Tofu', category: 'legumineuses', age: 36, allergen: 'soja' },

  // Viandes
  { name: 'Poulet', category: 'viandes', age: 4 },
  { name: 'Dinde', category: 'viandes', age: 4 },
  { name: 'Bœuf', category: 'viandes', age: 4 },
  { name: 'Veau', category: 'viandes', age: 4 },
  { name: 'Agneau', category: 'viandes', age: 4 },
  { name: 'Porc', category: 'viandes', age: 4 },
  { name: 'Jambon blanc', category: 'viandes', age: 8 },
  { name: 'Lapin', category: 'viandes', age: 4 },

  // Poissons
  { name: 'Cabillaud', category: 'poissons', age: 4, allergen: 'poisson' },
  { name: 'Saumon', category: 'poissons', age: 4, allergen: 'poisson' },
  { name: 'Sole', category: 'poissons', age: 4, allergen: 'poisson' },
  { name: 'Merlu', category: 'poissons', age: 4, allergen: 'poisson' },
  { name: 'Sardine', category: 'poissons', age: 4, allergen: 'poisson' },
  { name: 'Maquereau', category: 'poissons', age: 4, allergen: 'poisson' },
  { name: 'Truite', category: 'poissons', age: 4, allergen: 'poisson' },

  // Œufs
  { name: 'Œuf entier (bien cuit)', category: 'oeufs', age: 4, allergen: 'oeuf' },
  { name: "Jaune d'œuf", category: 'oeufs', age: 4, allergen: 'oeuf' },

  // Produits laitiers
  { name: 'Yaourt nature', category: 'produits_laitiers', age: 4, allergen: 'lait' },
  { name: 'Fromage blanc', category: 'produits_laitiers', age: 4, allergen: 'lait' },
  { name: 'Petit-suisse', category: 'produits_laitiers', age: 4, allergen: 'lait' },
  { name: 'Camembert pasteurisé', category: 'produits_laitiers', age: 4, allergen: 'lait' },
  { name: 'Comté', category: 'produits_laitiers', age: 4, allergen: 'lait' },
  { name: 'Emmental', category: 'produits_laitiers', age: 4, allergen: 'lait' },
  { name: 'Chèvre frais pasteurisé', category: 'produits_laitiers', age: 4, allergen: 'lait' },
  { name: 'Fromage de brebis pasteurisé', category: 'produits_laitiers', age: 4, allergen: 'lait' },
  { name: 'Beurre', category: 'matieres_grasses', age: 4, allergen: 'lait' },

  // Allergènes à introduire tôt
  { name: 'Beurre de cacahuète (lisse)', category: 'allergenes', age: 4, allergen: 'arachide' },
  { name: "Purée d'amande", category: 'allergenes', age: 4, allergen: 'fruits_a_coque' },
  { name: 'Purée de noisette', category: 'allergenes', age: 4, allergen: 'fruits_a_coque' },
  { name: 'Purée de noix de cajou', category: 'allergenes', age: 4, allergen: 'fruits_a_coque' },
  { name: 'Tahin (sésame)', category: 'allergenes', age: 4, allergen: 'sesame' },

  // Matières grasses
  { name: "Huile d'olive", category: 'matieres_grasses', age: 4 },
  { name: 'Huile de colza', category: 'matieres_grasses', age: 4 },
  {
    name: 'Huile de noix',
    category: 'matieres_grasses',
    age: 4,
    allergen: 'fruits_a_coque'
  },

  // Aromates
  { name: 'Persil', category: 'aromates', age: 4 },
  { name: 'Basilic', category: 'aromates', age: 4 },
  { name: 'Ciboulette', category: 'aromates', age: 4 },
  { name: 'Coriandre', category: 'aromates', age: 4 },
  { name: 'Menthe', category: 'aromates', age: 4 },
  { name: 'Thym', category: 'aromates', age: 4 },
  { name: 'Cumin', category: 'aromates', age: 4 },
  { name: 'Curcuma', category: 'aromates', age: 4 },
  { name: 'Cannelle', category: 'aromates', age: 4 },
  { name: 'Paprika doux', category: 'aromates', age: 4 }
];

export function seedFoods(db: AnyDb): void {
  // bun:sqlite is synchronous and serializes writers (one writer per file), so
  // the prior pg_advisory_xact_lock dance isn't needed: this transaction holds
  // the database for its duration. ON CONFLICT DO NOTHING plus the partial
  // unique index foods_name_seed_idx still guard against a seeder racing an
  // operator restore or a divergent future seeder.
  db.transaction((tx) => {
    const [{ n }] = tx.select({ n: count() }).from(foods).all();
    const total = Number(n);

    if (total === 0) {
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

      tx.insert(foods).values(rows).onConflictDoNothing().run();
    }

    applySeedCorrections(tx);
  });
}

// Self-healing pass for seed-row drift that older deployments may carry.
// Custom foods are never touched.
export function applySeedCorrections(db: Tx): void {
  db.run(sql`
    UPDATE foods
    SET name = CASE name
      WHEN 'Camembert' THEN 'Camembert pasteurisé'
      WHEN 'Chèvre frais' THEN 'Chèvre frais pasteurisé'
      WHEN 'Brebis (fromage)' THEN 'Fromage de brebis pasteurisé'
    END
    WHERE is_custom = 0
      AND name IN ('Camembert', 'Chèvre frais', 'Brebis (fromage)')
  `);
  for (const food of FOODS_SEED) {
    db.run(sql`
      UPDATE foods
      SET category = ${food.category},
          is_major_allergen = ${food.allergen != null},
          allergen_type = ${food.allergen ?? null},
          suggested_age_months = ${food.age}
      WHERE name = ${food.name}
        AND is_custom = 0
    `);
  }
}
