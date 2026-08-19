// Structured, source-cited per-stage amounts. One source of truth for the
// totals card and the per-item repères shown on the menu.
import type { StageId } from './guidance';
import type { SourceId } from './sources';

export type StageQuantities = {
  stageId: StageId;
  milkPerDay: string;
  meals: string;
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
    milkPerDay: 'à la demande ou selon les conseils du professionnel de santé',
    meals: 'quelques cuillères à un repas',
    proteinPerDay: 'petites quantités possibles',
    eggFraction: null,
    fishPerWeek: null,
    portions: {
      legume: 'quelques cuillères',
      fruit: 'quelques cuillères',
      feculent: 'quelques cuillères',
      laitier: 'possible, sans remplacer le lait',
      matiereGrasse: '1 c. à café/jour au total'
    },
    notes: ['Le lait reste l’aliment principal.', 'Respecter l’appétit, sans forcer.'],
    sources: ['spf-pnns-guide', 'spf-meal-memo', 'hcsp-2020', '1000-jours']
  },
  '6-9': {
    stageId: '6-9',
    milkPerDay: 'environ 500 mL/j',
    meals: 'rythme évoluant souvent vers 4 repas autour de 8 mois',
    proteinPerDay: '10 g/j (1×)',
    eggFraction: '¼',
    fishPerWeek: '2×/sem. dont un gras',
    portions: {
      legume: '½ de la purée',
      fruit: 'selon l’appétit',
      feculent: '½ de la purée',
      laitier: 'en option, sans remplacer le lait',
      matiereGrasse: '1 c. à café/jour au total'
    },
    notes: ['Viande / poisson / œuf une fois par jour.'],
    sources: ['spf-pnns-guide', 'spf-meal-memo', 'hcsp-2020']
  },
  '9-12': {
    stageId: '9-12',
    milkPerDay: 'environ 500 mL/j',
    meals: '4 repas',
    proteinPerDay: '10 g/j (1×)',
    eggFraction: '¼',
    fishPerWeek: '2×/sem. dont un gras',
    portions: {
      legume: '½ de la purée',
      fruit: 'selon l’appétit',
      feculent: '½ de la purée',
      laitier: 'en option, sans remplacer le lait',
      matiereGrasse: '1 c. à café/jour au total'
    },
    notes: ['Le tiers d’œuf commence après 1 an.'],
    sources: ['spf-pnns-guide', 'spf-meal-memo', 'hcsp-2020']
  },
  '12-36': {
    stageId: '12-36',
    milkPerDay: '~500 mL/j ; max. 800 mL lait + équivalents laitiers',
    meals: '4 repas',
    proteinPerDay: '20 g/j (1–2 ans), 30 g/j (2–3 ans)',
    eggFraction: '⅓–½',
    fishPerWeek: '2×/sem. dont un gras',
    portions: {
      legume: 'selon l’appétit',
      fruit: 'selon l’appétit',
      feculent: '3–4 c. à soupe/jour',
      laitier: 'en option selon le repas',
      matiereGrasse: '2 c. à café/jour au total'
    },
    notes: ['Sel et sucre ajoutés restent à limiter.'],
    sources: ['spf-pnns-guide', 'spf-meal-memo', 'hcsp-2020']
  }
};

export function getQuantitiesForStage(stageId: StageId): StageQuantities {
  return QUANTITIES[stageId];
}
