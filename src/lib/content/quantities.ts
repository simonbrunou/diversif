// Structured, source-cited per-stage amounts. Figures lifted from guidance.ts —
// no new medical claims. One source of truth for the totals card and the
// per-item repères shown on the menu.
import type { StageId } from './guidance';
import type { SourceId } from './sources';

export type StageQuantities = {
  stageId: StageId;
  milkPerDay: string;
  meals: number;
  proteinPerDay: string;
  eggFraction: string | null;
  fishPerWeek: string | null;
  portions: {
    legume: string;
    fruit: string;
    feculent: string;
    laitier: string;
    matiereGrasse: string;
  };
  notes: string[];
  sources: SourceId[];
};

export const QUANTITIES: Record<StageId, StageQuantities> = {
  '4-6': {
    stageId: '4-6',
    milkPerDay: '~600–800 mL/j',
    meals: 2,
    proteinPerDay: 'premières protéines vers 6 mois',
    eggFraction: null,
    fishPerWeek: null,
    portions: {
      legume: '~1–3 c. à café',
      fruit: '~1–3 c. à café',
      feculent: 'quelques c. à café',
      laitier: '—',
      matiereGrasse: '1 c. à café'
    },
    notes: ['Le lait reste le repas principal.', 'Une nouvelle saveur à la fois.'],
    sources: ['spf-pnns-guide', 'hcsp-2020', '1000-jours']
  },
  '6-9': {
    stageId: '6-9',
    milkPerDay: '~500 mL/j',
    meals: 4,
    proteinPerDay: '10–20 g/j (1×)',
    eggFraction: '¼',
    fishPerWeek: '2×/sem. dont un gras',
    portions: {
      legume: '~130 g',
      fruit: '~1 au goûter',
      feculent: '2–3 c. à soupe',
      laitier: '1 laitage',
      matiereGrasse: '1 c. à café/repas'
    },
    notes: ['Viande / poisson / œuf une fois par jour.'],
    sources: ['spf-pnns-guide', 'hcsp-2020', 'espghan-2017']
  },
  '9-12': {
    stageId: '9-12',
    milkPerDay: '~500 mL/j',
    meals: 4,
    proteinPerDay: '20–30 g/j (1×)',
    eggFraction: '¼',
    fishPerWeek: '2×/sem. dont un gras',
    portions: {
      legume: '~150 g',
      fruit: '~1 au goûter',
      feculent: '3–4 c. à soupe',
      laitier: '1 laitage',
      matiereGrasse: '1 c. à café/repas'
    },
    notes: ['Le tiers d’œuf commence après 1 an.'],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  '12-36': {
    stageId: '12-36',
    milkPerDay: '~500 mL/j (lait de croissance)',
    meals: 4,
    proteinPerDay: '30 g/j → 50 g vers 3 ans',
    eggFraction: '⅓–½',
    fishPerWeek: '2×/sem. dont un gras',
    portions: {
      legume: 'à chaque repas',
      fruit: 'à chaque repas',
      feculent: 'à chaque repas',
      laitier: '2–3/j',
      matiereGrasse: '1 c. à café/repas'
    },
    notes: ['Sel et sucre ajoutés restent à limiter.'],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  }
};

export function getQuantitiesForStage(stageId: StageId): StageQuantities {
  return QUANTITIES[stageId];
}
