// Recipe ideas grouped by diversification stage. These are inspiration cards,
// not cookbook entries — each recipe lists only its ingredients and a target
// prep time, never step-by-step instructions or medical advice. Parents who
// want a full recipe should fall back to authored cookbooks or HAS-validated
// material; diversif's role here is just to suggest stage-appropriate prep
// ideas the parent might not have thought of.
//
// `stage` matches `StageId` from src/lib/content/guidance.ts. Each card surfaces
// only when the current child's stage matches; never gated by allergen status
// or food-introduction history (a recipe involving œuf still shows up at 6-9m
// even if the child hasn't introduced œuf — the parent is responsible for
// skipping or substituting).

import type { StageId } from './guidance';

export type Recipe = {
  id: string;
  stage: StageId;
  title: string;
  subtitle: string;
  timeMinutes: number;
  ingredients: string[];
};

export const RECIPES: readonly Recipe[] = [
  // 4-6 months: purées lisses, premières découvertes
  {
    id: 'puree-carotte-douce',
    stage: '4-6',
    title: 'Purée de carotte douce',
    subtitle: 'Première purée toute simple, lisse et sucrée.',
    timeMinutes: 20,
    ingredients: ['2 carottes', '1 c. à café d’huile de colza', '2 c. à soupe de lait infantile']
  },
  {
    id: 'compote-pomme-nature',
    stage: '4-6',
    title: 'Compote de pomme nature',
    subtitle: 'Une compote sans sucre ajouté, idéale au goûter.',
    timeMinutes: 15,
    ingredients: ['2 pommes douces (Gala, Golden)', '1 c. à soupe d’eau']
  },
  {
    id: 'puree-patate-douce',
    stage: '4-6',
    title: 'Purée de patate douce',
    subtitle: 'Une douceur orange, riche en bêta-carotène.',
    timeMinutes: 25,
    ingredients: [
      '1 petite patate douce',
      '1 c. à café d’huile de colza',
      'Lait infantile pour détendre'
    ]
  },

  // 6-9 months: purées épaissies, premiers morceaux fondants
  {
    id: 'puree-courgette-basilic',
    stage: '6-9',
    title: 'Purée courgette-basilic',
    subtitle: 'Une purée verte douce, parfumée au basilic frais.',
    timeMinutes: 20,
    ingredients: [
      '1 courgette épluchée, épépinée',
      '1 feuille de basilic',
      '1 c. à café d’huile d’olive'
    ]
  },
  {
    id: 'veloute-potiron-cumin',
    stage: '6-9',
    title: 'Velouté potiron-cumin',
    subtitle: 'Un velouté d’automne aux notes orientales.',
    timeMinutes: 25,
    ingredients: ['200 g de potiron', 'Une pincée de cumin doux', 'Lait infantile pour la texture']
  },
  {
    id: 'compote-pomme-poire',
    stage: '6-9',
    title: 'Compote pomme-poire',
    subtitle: 'Le duo classique, sans sucre ajouté.',
    timeMinutes: 15,
    ingredients: ['1 pomme', '1 poire mûre', '1 c. à soupe d’eau']
  },

  // 9-12 months: textures écrasées, premiers petits morceaux à mâcher
  {
    id: 'risotto-petits-pois',
    stage: '9-12',
    title: 'Risotto de petits pois',
    subtitle: 'Un risotto fondant, riche en goût et facile à attraper.',
    timeMinutes: 30,
    ingredients: ['60 g de riz rond', '50 g de petits pois', 'Bouillon de légumes sans sel']
  },
  {
    id: 'galette-pdt-brocoli',
    stage: '9-12',
    title: 'Galettes pomme de terre & brocoli',
    subtitle: 'Des galettes à saisir avec les doigts, douces et vertes.',
    timeMinutes: 25,
    ingredients: ['1 pomme de terre cuite', '50 g de brocoli cuit', '1 œuf entier bien cuit']
  },
  {
    id: 'crumble-peche-avoine',
    stage: '9-12',
    title: 'Crumble de pêche aux flocons d’avoine',
    subtitle: 'Un dessert tiède, craquant et fondant à la fois.',
    timeMinutes: 25,
    ingredients: ['2 pêches mûres', '2 c. à soupe de flocons d’avoine', '1 c. à café de beurre']
  },

  // 12-36 months: repas famille adaptés
  {
    id: 'curry-doux-lentilles',
    stage: '12-36',
    title: 'Curry doux de lentilles',
    subtitle: 'Un plat complet, doucement épicé, riche en fer.',
    timeMinutes: 35,
    ingredients: [
      '80 g de lentilles cuites',
      '1 carotte',
      '1 courgette',
      'Une pincée de curcuma et de cumin'
    ]
  },
  {
    id: 'mini-quiche-epinards',
    stage: '12-36',
    title: 'Mini-quiches aux épinards',
    subtitle: 'Une bouchée à saisir, parfaite pour le repas du soir.',
    timeMinutes: 30,
    ingredients: [
      '1 œuf entier bien cuit',
      '50 g d’épinards cuits',
      '1 c. à soupe de fromage blanc'
    ]
  },
  {
    id: 'boulettes-poulet-herbes',
    stage: '12-36',
    title: 'Boulettes de poulet aux herbes',
    subtitle: 'Des boulettes moelleuses, à saisir ou à la fourchette.',
    timeMinutes: 25,
    ingredients: [
      '100 g de poulet haché',
      '1 c. à soupe de persil ciselé',
      '1 c. à soupe de ciboulette ciselée'
    ]
  }
] as const;

export function getRecipesForStage(stage: StageId): Recipe[] {
  return RECIPES.filter((r) => r.stage === stage);
}
