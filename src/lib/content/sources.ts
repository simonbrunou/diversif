// Authoritative references cited by the in-app guidance. Each claim shown to
// the user can be traced back here via SourceId. URLs are stable as of 2026.

export type Source = {
  label: string;
  org: string;
  year: number;
  url: string;
};

export const SOURCES = {
  'spf-pnns-guide': {
    label:
      'Pas à pas, votre enfant mange comme un grand : Le petit guide de la diversification alimentaire',
    org: 'Santé publique France / PNNS',
    year: 2021,
    url: 'https://www.mangerbouger.fr/content/show/1500/file/Brochure-SPF-Mangerbougerfr.pdf'
  },
  'spf-recos': {
    label: "Recommandations sur la diversification alimentaire des enfants jusqu'à 3 ans",
    org: 'Santé publique France',
    year: 2021,
    url: 'https://www.mangerbouger.fr/ressources-pros/elaboration-des-recommandations-nutritionnelles/les-recommandations-sur-la-diversification-alimentaire-des-enfants-jusqu-a-3-ans'
  },
  'hcsp-2020': {
    label: 'Avis relatif à la révision des repères alimentaires pour les enfants de moins de 3 ans',
    org: 'HCSP',
    year: 2020,
    url: 'https://www.hcsp.fr/Explore.cgi/Telecharger?NomFichier=hcspa20200630_rvisidesreprealimepourlesenfan.pdf'
  },
  '1000-jours': {
    label: "1000 premiers jours : l'alimentation de 4 à 6 mois",
    org: 'Gouvernement français',
    year: 2023,
    url: 'https://www.1000-premiers-jours.fr/fr/lalimentation-de-4-6-mois-le-debut-de-la-diversification'
  },
  'espghan-2017': {
    label: 'Complementary Feeding: A Position Paper by the ESPGHAN Committee on Nutrition',
    org: 'ESPGHAN (Fewtrell et al., JPGN)',
    year: 2017,
    url: 'https://www.espghan.org/dam/jcr:3d960daa-e2f3-499f-9df9-2da682976cec/2017%20Complementary_Feeding__A_Position_Paper_by_the.21.pdf'
  },
  'leap-2015': {
    label: 'Randomized Trial of Peanut Consumption in Infants at Risk for Peanut Allergy',
    org: 'NEJM (Du Toit et al.)',
    year: 2015,
    url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1414850'
  },
  'eat-2016': {
    label: 'Randomized Trial of Introduction of Allergenic Foods in Breast-Fed Infants',
    org: 'NEJM (Perkin et al.)',
    year: 2016,
    url: 'https://www.nejm.org/doi/full/10.1056/NEJMoa1514210'
  },
  'sfp-dme': {
    label: "La diversification alimentaire menée par l'enfant : position du Comité de nutrition",
    org: 'Société Française de Pédiatrie (Bocquet et al.)',
    year: 2022,
    url: 'https://www.sfpediatrie.com/sites/www.sfpediatrie.com/files/medias/documents/dme_perfectionnement_bocquet_et_al.pdf'
  },
  'who-cf': {
    label: 'Complementary feeding',
    org: 'Organisation mondiale de la santé (OMS)',
    year: 2023,
    url: 'https://www.who.int/health-topics/complementary-feeding'
  },
  'anses-nourrisson': {
    label: 'Repères alimentaires pour les nourrissons',
    org: 'ANSES',
    year: 2019,
    url: 'https://www.anses.fr/fr/content/alimentation-des-enfants-de-0-3-ans'
  }
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

export function getSource(id: SourceId): Source {
  return SOURCES[id];
}

export const ALL_SOURCE_IDS = Object.keys(SOURCES) as SourceId[];
