// Authoritative references cited by the in-app guidance. Each claim shown to
// the user can be traced back here via SourceId. URLs are stable as of 2026.

type Source = {
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
    year: 2022,
    url: 'https://www.mangerbouger.fr/content/show/1500/file/Brochure_diversification_alimentaire_Pas_a_pas_votre_enfant_mange_comme_un_grand.pdf'
  },
  'spf-meal-memo': {
    label: 'Fiches mémo diversification : des repas-types de 4 mois à 3 ans',
    org: 'Santé publique France / PNNS',
    year: 2025,
    url: 'https://www.mangerbouger.fr/content/show/2253/file/1011-Spf_fiches%20memo%20diversification.pdf'
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
  'eaaci-2020': {
    label:
      'EAACI guideline: Preventing the development of food allergy in infants and young children — 2020 update',
    org: 'European Academy of Allergy and Clinical Immunology',
    year: 2021,
    url: 'https://eaaci.org/guidelines-position-papers/eaaci-guideline-preventing-the-development-of-food-allergy-in-infants-and-young-children-2020-update/'
  },
  'ascia-2026': {
    label: 'ASCIA Guidelines: Infant Feeding for Food Allergy Prevention',
    org: 'Australasian Society of Clinical Immunology and Allergy',
    year: 2026,
    url: 'https://www.allergy.org.au/hp/papers/infant-feeding-and-allergy-prevention'
  },
  'eu-1169-2011': {
    label: 'Règlement (UE) n° 1169/2011, annexe II — substances provoquant des allergies',
    org: 'Union européenne',
    year: 2011,
    url: 'https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32011R1169'
  },
  'ameli-allergie': {
    label: 'Allergie alimentaire : définition et symptômes',
    org: 'Assurance Maladie',
    year: 2025,
    url: 'https://www.ameli.fr/assure/sante/themes/allergie-alimentaire/definition-symptomes'
  },
  'ameli-oedeme': {
    label: 'Œdème de Quincke : situations urgentes et numéros à appeler',
    org: 'Assurance Maladie',
    year: 2026,
    url: 'https://www.ameli.fr/assure/sante/urgence/pathologies/oedeme-quincke'
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
    url: 'https://www.anses.fr/fr/system/files/NUT2017SA0145.pdf'
  }
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

export const ALL_SOURCE_IDS = Object.keys(SOURCES) as SourceId[];
