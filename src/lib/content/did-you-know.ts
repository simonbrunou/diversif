// Short evidence-based fact cards surfaced on the Discover tab. Each card is
// a single claim sourced from at least one entry in `sources.ts`. Copy is
// deliberately short: a one-line title (often phrased as the myth or
// question) plus 1–2 sentences of body. Anything that requires a longer
// caveat should live in the guide page, not here.
//
// New cards should:
//   - cite at least one SourceId,
//   - phrase the title as a question or surprising claim,
//   - keep the body under ~280 characters so it fits a single chip card.

import type { SourceId } from './sources';

export type FactCard = {
  id: string;
  title: string;
  body: string;
  sources: SourceId[];
};

export const FACT_CARDS: readonly FactCard[] = [
  {
    id: 'arachide-tot',
    title: 'L’arachide, on l’introduit tôt ?',
    body: "Oui. L'étude LEAP (2015) montre qu'introduire l'arachide en purée entre 4 et 11 mois divise par 5 le risque d'allergie à 5 ans, comparé à une introduction tardive.",
    sources: ['leap-2015', 'hcsp-2020']
  },
  {
    id: 'miel-avant-1-an',
    title: 'Du miel avant 1 an ?',
    body: "Jamais. Le miel peut contenir des spores de Clostridium botulinum, responsables d'une intoxication grave chez le nourrisson (botulisme infantile). À partir de 12 mois révolus seulement.",
    sources: ['anses-nourrisson', 'hcsp-2020']
  },
  {
    id: 'lait-vache-1-an',
    title: 'Lait de vache comme boisson principale ?',
    body: "Pas avant 1 an. Il est pauvre en fer et trop riche en protéines pour les reins du nourrisson. En cuisine (un peu dans une purée), c'est différent.",
    sources: ['hcsp-2020', 'anses-nourrisson']
  },
  {
    id: 'sel-avant-1-an',
    title: 'On sale les plats de bébé ?',
    body: 'Non. Avant 1 an, les reins ne savent pas éliminer le sel. Le HCSP recommande de ne pas ajouter de sel à la cuisson et de limiter les aliments salés (charcuterie, fromages affinés, plats du commerce).',
    sources: ['hcsp-2020']
  },
  {
    id: 'neophobie',
    title: 'Mon bébé refuse, j’abandonne ?',
    body: "Surtout pas. L'acceptation d'un goût peut demander jusqu'à 8 à 10 expositions sans pression. La néophobie alimentaire est normale entre 18 mois et 3 ans.",
    sources: ['spf-pnns-guide', '1000-jours']
  },
  {
    id: 'jus-de-fruits',
    title: 'Un peu de jus de fruits ?',
    body: 'Pas avant 12 mois, et très limité ensuite. Le jus apporte du sucre libre sans les fibres du fruit, et habitue à un goût très sucré. Préférez le fruit entier mixé ou écrasé.',
    sources: ['anses-nourrisson', 'hcsp-2020']
  },
  {
    id: 'fruits-secs-entiers',
    title: 'Fruits à coque entiers ?',
    body: "Risque d'étouffement avant 4 à 5 ans. En purée ou en poudre intégrée à une préparation, c'est sans risque et nutritionnellement intéressant : noix, amandes, noisettes apportent de bons acides gras.",
    sources: ['hcsp-2020', 'anses-nourrisson']
  },
  {
    id: 'bio-vs-conv',
    title: 'Forcément bio ?',
    body: "Le bio n'apporte pas d'avantage nutritionnel démontré. L'ANSES recommande surtout la diversité, des produits frais et de saison, et un rinçage soigneux. Le bio peut limiter l'exposition à certains résidus de pesticides, sans plus.",
    sources: ['anses-nourrisson']
  }
] as const;
