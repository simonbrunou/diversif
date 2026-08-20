// Single source of truth for all in-app diversification guidance (FR).
// Every claim that comes from an official guideline carries SourceId(s).
// Edited by hand; UI templates should never duplicate this copy.

import type { AllergenId } from '$lib/utils/allergens';
import type { CategoryId } from '$lib/utils/categories';
import type { SourceId } from './sources';

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

export type StageId = '4-6' | '6-9' | '9-12' | '12-36';

export type Stage = {
  id: StageId;
  ageMin: number; // months, inclusive
  ageMax: number; // months, exclusive (36 = 3 ans)
  title: string;
  oneLiner: string;
  principles: string[];
  focus: string[];
  textures: string;
  milkTarget: string;
  redFlags: string[];
  sources: SourceId[];
};

export const STAGES = [
  {
    id: '4-6',
    ageMin: 4,
    ageMax: 6,
    title: '4–6 mois · Le démarrage en douceur',
    oneLiner:
      'On lance la diversification entre 4 mois révolus et 6 mois, lorsque le développement de bébé le permet.',
    principles: [
      'Commencer par quelques cuillères puis augmenter selon l’appétit, sans forcer.',
      'Tous les groupes peuvent être proposés, y compris les allergènes : gluten, œuf, arachide en purée, lait sous forme de yaourt/fromage.',
      'Le lait maternel à la demande ou le lait infantile reste l’aliment principal.',
      'Ne pas saler, ne pas sucrer ; ajouter au total une cuillère à café de matière grasse par jour.'
    ],
    focus: [
      'Légumes cuits écrasés ou en purée lisse (carotte, courgette épluchée, haricot vert, potiron, panais).',
      'Fruits cuits ou bien mûrs en purée (pomme, poire, banane, avocat).',
      'Viande, poisson, œuf bien cuit et légumineuses bien cuites peuvent être proposés dès le début, en petite quantité.',
      "Premiers allergènes en purée lisse : œuf bien cuit, beurre de cacahuète dilué, purée d'amande."
    ],
    textures: 'Purée lisse, sans morceaux. À la cuillère.',
    milkTarget:
      'Lait maternel à la demande, ou biberons habituels de lait infantile selon l’appétit.',
    redFlags: [
      'Ne pas démarrer avant 4 mois révolus (système digestif et rénal immatures).',
      'Ne pas attendre après 6 mois pour commencer la diversification.'
    ],
    sources: ['spf-pnns-guide', 'hcsp-2020', '1000-jours', 'espghan-2017']
  },
  {
    id: '6-9',
    ageMin: 6,
    ageMax: 9,
    title: '6–9 mois · On élargit, on apporte du fer',
    oneLiner:
      'On poursuit toutes les familles d’aliments, avec une petite portion quotidienne de viande, poisson ou œuf.',
    principles: [
      'Tous les groupes en routine : légumes, fruits, féculents, légumineuses, viande, poisson, œuf, produits laitiers, allergènes.',
      'Augmenter progressivement la quantité ; le rythme évolue souvent vers 4 repas autour de 8 mois.',
      "Continuer à proposer un aliment refusé jusqu'à ~10 fois : l'acceptation gustative se construit.",
      'Ajouter au total une cuillère à café de matière grasse par jour, crue à la fin de la cuisson (huiles variées ; beurre de temps en temps).'
    ],
    focus: [
      'Viande / poisson / œuf : 10 g par jour au total (≈ 2 cuillères à café). Poisson 2 fois par semaine dont un gras (saumon, sardine).',
      "Œuf entier bien cuit (jaune + blanc) : ~1/4 d'œuf, à augmenter après 1 an (1/3 entre 1–2 ans, 1/2 entre 2–3 ans).",
      'Allergènes : une fois la diversification commencée, ne pas retarder œuf bien cuit, arachide et fruits à coque en purée, gluten, poisson, lait et sésame. Les produits à base de soja sont déconseillés avant 3 ans.',
      'Légumineuses cuites bien écrasées (lentilles corail, pois chiches, haricots blancs).'
    ],
    textures:
      'Mouliné fin → écrasé fondant. Premiers petits morceaux fondants vers 8 mois (banane, avocat, courgette cuite).',
    milkTarget: 'Lait maternel à la demande ou environ 500 mL/jour de lait 2ᵉ âge.',
    redFlags: [
      'Pas de lait de vache liquide en boisson principale avant 1 an (yaourts/fromages OK).',
      'Pas de miel.',
      'Pas de fruits à coque entiers (étouffement) : uniquement en purée fine.'
    ],
    sources: ['spf-pnns-guide', 'hcsp-2020', 'espghan-2017']
  },
  {
    id: '9-12',
    ageMin: 9,
    ageMax: 12,
    title: "9–12 mois · Vers les morceaux et l'autonomie",
    oneLiner:
      'Bébé mâchonne, pince entre pouce et index, peut tenir un morceau dans la main. On évolue vers des textures plus riches et des aliments à saisir sécurisés.',
    principles: [
      'Petits morceaux fondants, aliments à saisir : bâtonnets de légumes bien cuits, morceaux de fruits mûrs, pâtes bien cuites.',
      'Repas en commun à table familiale ; bébé observe et imite.',
      'Continuer la diversification : épices douces (cumin, paprika doux, curcuma, herbes fraîches).',
      "Proposer l'eau dans un petit verre / une paille."
    ],
    focus: [
      'Variété de céréales et féculents (riz, pâtes, semoule, polenta, sarrasin, quinoa, pomme de terre).',
      'Fromages variés (à pâte pressée cuite type comté, emmental ; pâtes molles type camembert pasteurisé).',
      'Une fois un allergène toléré, continuer à le proposer régulièrement, au moins chaque semaine.'
    ],
    textures:
      'Petits morceaux fondants ; aliments à saisir (bâtonnets, lamelles). Toujours sous surveillance.',
    milkTarget: "Environ 500 mL/jour de lait 2ᵉ âge ou poursuite de l'allaitement.",
    redFlags: [
      "Pas d'aliments durs et ronds (raisins entiers, tomates cerises entières, saucisses rondes, carotte crue) : découper.",
      'Toujours assis, toujours surveillé pendant les repas.'
    ],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  {
    id: '12-36',
    ageMin: 12,
    ageMax: 36,
    title: '12 mois–3 ans · Comme un grand, en adapté',
    oneLiner:
      'Bébé partage les repas familiaux en versions adaptées : moins salées, moins sucrées, morceaux découpés.',
    principles: [
      'Repas familiaux adaptés : sans sel ajouté, peu de produits sucrés, gras de qualité.',
      'Maintenir la variété sur la journée et la semaine, en respectant l’appétit.',
      'Poursuite de l’allaitement ou environ 500 mL/jour de lait adapté ; lait et équivalents laitiers ne dépassent pas 800 mL/jour.',
      'Continuer à proposer les aliments refusés : la fenêtre néophobique (~18–24 mois) est normale.'
    ],
    focus: [
      'Poisson 2 fois par semaine dont un gras.',
      'Légumes et fruits à chaque repas, frais ou surgelés natures.',
      'Viande, poisson ou œuf : 20 g/jour de 1 à 2 ans, puis 30 g/jour de 2 à 3 ans.',
      'Eau à volonté, en seule boisson.'
    ],
    textures: 'Toutes textures, en morceaux adaptés à la taille de la bouche.',
    milkTarget:
      'Environ 500 mL/jour ; au maximum 800 mL de lait + équivalents laitiers, ou poursuite de l’allaitement.',
    redFlags: [
      'Sel et sucre ajoutés restent à limiter strictement.',
      'Boissons végétales (amande, riz, avoine) ne remplacent pas le lait.',
      'Pas de fritures régulières, pas de produits ultra-transformés en routine.'
    ],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  }
] as const satisfies readonly Stage[];

// ---------------------------------------------------------------------------
// Key principles
// ---------------------------------------------------------------------------

export type KeyPrinciple = {
  id: string;
  title: string;
  body: string;
  sources: SourceId[];
};

export const KEY_PRINCIPLES: readonly KeyPrinciple[] = [
  {
    id: 'window-4-6',
    title: 'Démarrer entre 4 mois révolus et 6 mois',
    body: 'Pas avant 4 mois révolus. Après 6 mois révolus, le lait seul ne couvre plus tous les besoins nutritionnels ni les stimulations nécessaires au développement. Commencer entre 4 et 6 mois lorsque le développement de bébé le permet.',
    sources: ['hcsp-2020', 'spf-pnns-guide', '1000-jours']
  },
  {
    id: 'allergens-early',
    title: 'Ne pas retarder les allergènes',
    body: 'Dès que la diversification est lancée, proposer sous une forme adaptée œuf bien cuit, arachide, lait, gluten, poisson, fruits à coque et sésame. L’effet préventif est surtout démontré pour l’œuf bien cuit et l’arachide ; l’essai EAT n’était concluant que dans l’analyse des enfants ayant suivi le protocole. Les produits au soja sont déconseillés avant 3 ans.',
    sources: ['hcsp-2020', 'eaaci-2020', 'leap-2015', 'eat-2016']
  },
  {
    id: 'repeat-10',
    title: 'Reproposer un nouvel aliment ~10 fois',
    body: "L'acceptation d'un goût se construit avec la répétition. Un refus n'est pas définitif : reproposer le même aliment, à différents moments, sans forcer.",
    sources: ['spf-pnns-guide']
  },
  {
    id: 'add-fats',
    title: 'Ajouter des matières grasses systématiquement',
    body: "Avant 1 an : au total une cuillère à café d'huile par jour, ou de temps en temps une noisette de beurre, ajoutée après cuisson. De 1 à 3 ans : deux cuillères à café par jour.",
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  {
    id: 'no-added-sugar',
    title: 'Pas de sucre ajouté',
    body: "Retarder le plus longtemps possible les produits sucrés (biscuits, gâteaux, jus, sodas). Goûter les aliments tels qu'ils sont : bébé apprécie naturellement les vrais goûts.",
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  {
    id: 'no-added-salt',
    title: 'Pas de sel ajouté avant 3 ans',
    body: 'Ne pas saler les plats et limiter les aliments très salés comme la charcuterie, certains fromages et les plats préparés.',
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  {
    id: 'satiety',
    title: "Respecter l'appétit et la satiété",
    body: "Ne jamais forcer. Bébé sait réguler ce qu'il mange. Proposer, accompagner, observer les signes de fin de repas (détourne la tête, ferme la bouche, repousse).",
    sources: ['spf-pnns-guide']
  },
  {
    id: 'milk-stays',
    title: "Le lait reste l'aliment principal jusqu'à 1 an",
    body: 'Lait maternel à la demande ou environ 500 mL/jour de lait infantile entre 6 et 12 mois. La diversification complète le lait, elle ne le remplace pas.',
    sources: ['hcsp-2020', 'who-cf']
  },
  {
    id: 'cook-thoroughly',
    title: 'Cuissons à cœur',
    body: 'Viande, poisson et œuf : toujours bien cuits (pas de tartare, sushi, œuf coulant ni mayonnaise maison) afin de réduire les risques infectieux et parasitaires.',
    sources: ['spf-pnns-guide', 'anses-nourrisson']
  },
  {
    id: 'supervise',
    title: 'Toujours surveiller le repas',
    body: "Bébé mange assis bien droit, dans une chaise haute adaptée. Jamais en voiture, en poussette, allongé ou seul. Connaître les gestes de premiers secours en cas d'étouffement.",
    sources: ['sfp-dme', 'spf-pnns-guide']
  }
] as const;

// ---------------------------------------------------------------------------
// Per-allergen guidance
// ---------------------------------------------------------------------------

export type AllergenGuidance = {
  id: AllergenId;
  timing: string;
  why: string;
  howToOffer: string[];
  firstSigns: string[];
  severeSigns: string[];
  whatToDo: string;
  sources: SourceId[];
};

const ALLERGY_SAFETY_SOURCES = ['ameli-allergie', 'ameli-oedeme'] as const;

export const ALLERGEN_GUIDANCE: Record<AllergenId, AllergenGuidance> = {
  oeuf: {
    id: 'oeuf',
    timing: 'Dès 4–6 mois',
    why: 'L’œuf est un allergène majeur. Les recommandations européennes conseillent l’œuf bien cuit pendant la diversification, avec un bénéfice préventif surtout documenté lorsqu’il est introduit vers 4–6 mois.',
    howToOffer: [
      'Œuf entier bien cuit (jaune et blanc), durs ou en omelette bien cuite.',
      "~1/4 d'œuf entier (jaune + blanc) écrasé dans une purée à 6–12 mois, puis ~1/3 à 1–2 ans, puis ~1/2 à 2–3 ans (HCSP 2020).",
      "Pas d'œuf cru ou peu cuit (mayo maison, mousse au chocolat) avant 5 ans."
    ],
    firstSigns: [
      'Rougeurs autour de la bouche',
      "Petites plaques d'urticaire",
      'Vomissement isolé peu après la prise'
    ],
    severeSigns: [
      'Œdème des lèvres ou du visage',
      'Difficulté respiratoire, sifflement',
      'Vomissements répétés, perte de tonus, urticaire généralisée'
    ],
    whatToDo:
      'Arrêter l’aliment. Demander rapidement un avis médical avant toute nouvelle exposition. En cas de signe sévère, appeler immédiatement le 15 ou le 112.',
    sources: ['eaaci-2020', 'hcsp-2020', ...ALLERGY_SAFETY_SOURCES]
  },
  arachide: {
    id: 'arachide',
    timing: 'Dès 4–6 mois',
    why: 'Chez des nourrissons à haut risque, l’étude LEAP a montré une réduction allant jusqu’à 86 % de l’allergie à l’arachide dans un sous-groupe. En France, l’arachide ne doit pas être retardée une fois la diversification commencée.',
    howToOffer: [
      'Beurre de cacahuète **lisse** (sans morceaux) dilué dans une purée, un yaourt ou un peu de lait.',
      'Commencer par une petite quantité bien diluée, puis augmenter progressivement si elle est tolérée.',
      '**Jamais** de cacahuètes entières avant 5 ans (étouffement).',
      "Si bébé a un eczéma sévère ou une allergie à l'œuf : demander un avis médical avant l’introduction."
    ],
    firstSigns: ['Rougeurs locales', 'Démangeaisons buccales', "Plaques d'urticaire"],
    severeSigns: [
      'Œdème de la gorge, voix modifiée',
      'Difficulté respiratoire, sifflement',
      'Pâleur, perte de tonus, vomissements répétés'
    ],
    whatToDo:
      'Arrêter l’aliment et demander rapidement un avis médical avant toute ré-exposition. En cas de suspicion d’anaphylaxie : appeler immédiatement le 15 ou le 112.',
    sources: ['leap-2015', 'eaaci-2020', 'hcsp-2020', ...ALLERGY_SAFETY_SOURCES]
  },
  lait: {
    id: 'lait',
    timing: 'Dès 4–6 mois',
    why: 'Les protéines de lait de vache font partie des allergènes majeurs. Yaourt nature et fromage pasteurisé peuvent être proposés dès le début de la diversification, sans remplacer le lait maternel ou infantile.',
    howToOffer: [
      'Yaourt nature au lait entier, fromage blanc, petit-suisse, fromages à pâte pressée cuite.',
      'Le **lait de vache liquide** ne remplace pas le lait infantile avant 1 an (apport en fer insuffisant).',
      'Pas de fromages au lait cru avant 5 ans (sauf pâte pressée cuite type comté, emmental).'
    ],
    firstSigns: [
      'Régurgitations inhabituelles',
      'Diarrhée',
      'Eczéma qui se majore',
      "Petites plaques d'urticaire"
    ],
    severeSigns: [
      "Vomissements en jet répétés (suspicion de SEIPA : syndrome d'entérocolite induit)",
      'Œdème, gêne respiratoire, urticaire généralisée'
    ],
    whatToDo:
      'Arrêter et demander rapidement un avis médical avant toute ré-exposition. En cas de signe sévère, appeler le 15 ou le 112. Si une APLV est connue, suivre l’éviction prescrite.',
    sources: ['hcsp-2020', 'spf-pnns-guide', ...ALLERGY_SAFETY_SOURCES]
  },
  gluten: {
    id: 'gluten',
    timing: 'Dès 4–6 mois',
    why: 'Les céréales, y compris celles contenant du gluten, peuvent être proposées dès le début de la diversification. Éviter de très grandes quantités d’emblée.',
    howToOffer: [
      'Petites quantités de blé : pâtes bien cuites, semoule fine, pain, biscottes ramollies.',
      "L'allaitement au moment de l'introduction du gluten ne protège pas spécifiquement de la maladie cœliaque (donnée mise à jour ESPGHAN).",
      'Augmenter progressivement la quantité au cours des semaines suivantes.'
    ],
    firstSigns: [
      'Diarrhée prolongée',
      'Cassure de la courbe de poids',
      'Ballonnement, fatigue, irritabilité'
    ],
    severeSigns: ['Stagnation pondérale persistante avec signes digestifs'],
    whatToDo:
      'Devant une cassure pondérale ou des troubles digestifs persistants après introduction du gluten, consulter : la maladie cœliaque se diagnostique par sérologie sous régime gluten.',
    sources: ['espghan-2017', 'hcsp-2020', ...ALLERGY_SAFETY_SOURCES]
  },
  fruits_a_coque: {
    id: 'fruits_a_coque',
    timing: 'Dès 4–6 mois',
    why: 'Les fruits à coque sont des allergènes majeurs qui ne doivent pas être retardés une fois la diversification commencée. Les proposer uniquement en purée 100 % lisse.',
    howToOffer: [
      'Purée 100 % amande, noisette ou cajou, sans sucre ni sel, diluée dans une purée ou un yaourt.',
      '**Jamais** de fruit à coque entier avant 5 ans (étouffement) : toujours sous forme de purée fine.'
    ],
    firstSigns: ['Rougeurs', 'Démangeaisons buccales', 'Urticaire localisée'],
    severeSigns: ['Œdème, gêne respiratoire, urticaire généralisée'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['hcsp-2020', 'spf-pnns-guide', ...ALLERGY_SAFETY_SOURCES]
  },
  sesame: {
    id: 'sesame',
    timing: 'Dès 4–6 mois',
    why: 'Le sésame figure parmi les allergènes à déclaration obligatoire dans l’Union européenne. Il n’a pas à être retardé une fois la diversification commencée, mais son effet préventif est moins établi que celui de l’œuf et de l’arachide.',
    howToOffer: [
      'Tahin (purée de sésame) dilué dans une purée ou un houmous écrasé.',
      'Pas de graines de sésame entières avant que la mastication soit acquise.'
    ],
    firstSigns: ['Rougeurs locales', 'Urticaire'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['eu-1169-2011', 'hcsp-2020', 'eat-2016', ...ALLERGY_SAFETY_SOURCES]
  },
  soja: {
    id: 'soja',
    timing: 'À éviter avant 3 ans',
    why: 'Le soja contient des phyto-œstrogènes. HCSP 2020 et ANSES déconseillent les produits à base de soja avant 3 ans (tofu, boissons végétales, yaourts au soja). Il est suivi ici pour la complétude du carnet, pas comme un aliment à proposer tôt.',
    howToOffer: [
      'Avant 3 ans : éviter les produits à base de soja (tofu, yaourts au soja, boissons végétales au soja).',
      'Les boissons végétales au soja ne remplacent jamais le lait infantile.',
      'Si introduction après 3 ans : tofu nature bien cuit, en petite quantité.'
    ],
    firstSigns: ['Diarrhée, vomissements', "Plaques d'urticaire"],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['hcsp-2020', 'anses-nourrisson', ...ALLERGY_SAFETY_SOURCES]
  },
  poisson: {
    id: 'poisson',
    timing: 'Dès 4–6 mois',
    why: 'Le poisson apporte notamment des protéines, de l’iode et, pour les poissons gras, des oméga-3. Le repère est 2 fois par semaine, dont un poisson gras, en variant les espèces.',
    howToOffer: [
      'Cabillaud, sole, merlu, saumon, sardine, maquereau, truite : bien cuits, sans arêtes.',
      'Varier les espèces. Avant 3 ans, éviter espadon, marlin, siki, requin et lamproie ; limiter les autres poissons sauvages prédateurs.',
      'Privilégier les petits poissons gras (sardine, maquereau) plutôt que le thon.'
    ],
    firstSigns: ['Rougeurs autour de la bouche', 'Urticaire'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['anses-nourrisson', 'hcsp-2020', ...ALLERGY_SAFETY_SOURCES]
  },
  crustace: {
    id: 'crustace',
    timing: 'Pas de calendrier spécifique',
    why: 'Les crustacés sont des allergènes à déclaration obligatoire. Il n’existe pas de calendrier français spécifique ni de preuve comparable à l’œuf ou à l’arachide pour une introduction préventive ciblée.',
    howToOffer: [
      'Petits morceaux de crevette, langoustine, crabe bien cuits.',
      "Bien vérifier l'absence de coquille / fragments durs."
    ],
    firstSigns: ['Démangeaisons', 'Urticaire'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['eu-1169-2011', 'hcsp-2020', ...ALLERGY_SAFETY_SOURCES]
  },
  mollusque: {
    id: 'mollusque',
    timing: 'Pas de calendrier spécifique',
    why: 'Les mollusques sont des allergènes à déclaration obligatoire, sans calendrier français spécifique d’introduction préventive.',
    howToOffer: [
      'Coquille Saint-Jacques bien cuite, finement coupée.',
      'Pas d’huîtres crues avant 5 ans (risque infectieux).'
    ],
    firstSigns: ['Rougeurs', 'Urticaire'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['eu-1169-2011', 'hcsp-2020', ...ALLERGY_SAFETY_SOURCES]
  },
  celeri: {
    id: 'celeri',
    timing: 'Pas de calendrier spécifique',
    why: 'Le céleri figure parmi les allergènes à déclaration obligatoire, sans calendrier français spécifique d’introduction préventive.',
    howToOffer: [
      'Céleri-rave cuit, écrasé en purée mélangée à un autre légume.',
      'Petits morceaux fondants ensuite.'
    ],
    firstSigns: ['Démangeaisons buccales', 'Rougeurs'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['eu-1169-2011', 'hcsp-2020', ...ALLERGY_SAFETY_SOURCES]
  },
  moutarde: {
    id: 'moutarde',
    timing: 'Pas de calendrier spécifique',
    why: 'La moutarde figure parmi les allergènes à déclaration obligatoire, sans calendrier français spécifique d’introduction préventive.',
    howToOffer: [
      'Une petite quantité incorporée à un plat, sous une forme adaptée et peu salée.',
      'Éviter les moutardes très salées ou très fortes.'
    ],
    firstSigns: ['Démangeaisons buccales', 'Rougeurs'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['eu-1169-2011', 'hcsp-2020', ...ALLERGY_SAFETY_SOURCES]
  }
};

// ---------------------------------------------------------------------------
// Per-category guidance
// ---------------------------------------------------------------------------

export type CategoryGuidance = {
  id: CategoryId;
  why: string;
  whenStart: string;
  cadence: string;
  examples: string[];
  sources: SourceId[];
};

export const CATEGORY_GUIDANCE: Record<CategoryId, CategoryGuidance> = {
  legumes: {
    id: 'legumes',
    why: "Variété, fibres, vitamines, minéraux. Le bon point d'entrée gustatif.",
    whenStart: 'Dès 4 mois, en purée lisse.',
    cadence: 'Selon l’appétit, notamment au déjeuner et au dîner.',
    examples: ['Carotte', 'Courgette épluchée', 'Haricot vert', 'Potiron', 'Panais', 'Brocoli'],
    sources: ['spf-pnns-guide']
  },
  fruits: {
    id: 'fruits',
    why: 'Vitamines, fibres, hydratation. Goûts naturellement appréciés.',
    whenStart: 'Dès 4 mois, en purée ou bien mûrs et écrasés.',
    cadence: 'Selon l’appétit, notamment au goûter ou en dessert.',
    examples: ['Pomme', 'Poire', 'Banane', 'Avocat', 'Pêche'],
    sources: ['spf-pnns-guide']
  },
  feculents: {
    id: 'feculents',
    why: 'Apport en énergie. Indispensables pour soutenir la croissance.',
    whenStart: 'Dès 4–6 mois, y compris les céréales contenant du gluten.',
    cadence: 'Un féculent à chaque repas principal.',
    examples: ['Pomme de terre', 'Patate douce', 'Riz', 'Semoule', 'Pâtes bien cuites'],
    sources: ['spf-pnns-guide', 'espghan-2017']
  },
  legumineuses: {
    id: 'legumineuses',
    why: 'Protéines végétales et fer. Excellent complément à la viande.',
    whenStart: 'Dès 4–6 mois, bien cuites et écrasées.',
    cadence: 'À proposer régulièrement ; au moins 2 fois par semaine après 1 an.',
    examples: ['Lentilles corail', 'Pois chiches', 'Haricots blancs', 'Fèves'],
    sources: ['spf-pnns-guide']
  },
  viandes: {
    id: 'viandes',
    why: 'Apport majeur en fer (forme bien assimilée), zinc, vitamine B12.',
    whenStart: 'Dès 4–6 mois, mixée puis hachée.',
    cadence:
      'Avec poisson et œuf : 10 g/j de 6 à 12 mois, 20 g/j de 1 à 2 ans, puis 30 g/j de 2 à 3 ans.',
    examples: ['Poulet', 'Dinde', 'Bœuf', 'Veau', 'Agneau'],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  poissons: {
    id: 'poissons',
    why: 'Oméga-3 (DHA) essentiels au cerveau, iode, vitamine D.',
    whenStart: 'Dès 4–6 mois, bien cuit et sans arêtes.',
    cadence: '2 fois par semaine, dont un gras (saumon, sardine, maquereau).',
    examples: ['Cabillaud', 'Saumon', 'Sole', 'Sardine'],
    sources: ['anses-nourrisson', 'hcsp-2020']
  },
  oeufs: {
    id: 'oeufs',
    why: 'Protéines complètes, fer, vitamines. Allergène majeur à introduire tôt.',
    whenStart: 'Dès 4–6 mois, œuf entier bien cuit.',
    cadence:
      'Compte dans la portion quotidienne viande/poisson/œuf : ¼ avant 1 an, ⅓ de 1 à 2 ans, ½ de 2 à 3 ans.',
    examples: ['Œuf dur écrasé', 'Omelette bien cuite', 'Œuf brouillé'],
    sources: ['eaaci-2020', 'hcsp-2020']
  },
  produits_laitiers: {
    id: 'produits_laitiers',
    why: "Calcium, protéines. Le lait reste l'aliment principal jusqu'à 1 an.",
    whenStart:
      'Yaourt nature et fromage pasteurisé dès 4–6 mois. Le lait de vache **liquide** ne remplace pas le lait infantile avant 1 an.',
    cadence: 'En option selon les repas, sans remplacer le lait maternel ou infantile.',
    examples: ['Yaourt nature', 'Fromage blanc', 'Comté', 'Camembert pasteurisé'],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  allergenes: {
    id: 'allergenes',
    why: 'Une fois la diversification commencée, les allergènes ne doivent pas être retardés. L’effet préventif est surtout démontré pour l’œuf bien cuit et l’arachide.',
    whenStart: 'Dès 4–6 mois, en formes adaptées (purée fine).',
    cadence: 'Une fois toléré, **continuer à le proposer régulièrement**, au moins chaque semaine.',
    examples: ['Beurre de cacahuète lisse', "Purée d'amande", 'Tahin (sésame)', 'Œuf bien cuit'],
    sources: ['hcsp-2020', 'eaaci-2020', 'leap-2015', 'ascia-2026']
  },
  matieres_grasses: {
    id: 'matieres_grasses',
    why: 'Acides gras essentiels au développement cérébral. À ajouter systématiquement aux préparations maison.',
    whenStart: 'Dès le démarrage de la diversification.',
    cadence:
      'Au total par jour : 1 cuillère à café avant 1 an, puis 2 cuillères à café de 1 à 3 ans.',
    examples: ['Huile de colza', "Huile d'olive", 'Beurre pasteurisé', 'Huile de noix'],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  aromates: {
    id: 'aromates',
    why: 'Diversifier les goûts sans saler. Habituer bébé à la richesse aromatique.',
    whenStart: 'Dès 4–6 mois, en petite quantité.',
    cadence: 'À volonté, en petite quantité.',
    examples: ['Persil', 'Basilic', 'Thym', 'Cumin', 'Curcuma'],
    sources: ['spf-pnns-guide']
  },
  autre: {
    id: 'autre',
    why: 'Autres aliments hors catégories principales.',
    whenStart: 'Selon le type.',
    cadence: 'Variable.',
    examples: [],
    sources: []
  }
};

// ---------------------------------------------------------------------------
// Texture progression
// ---------------------------------------------------------------------------

export type TextureStep = {
  ageMonths: number;
  texture: string;
  examples: string[];
  markers: string[];
};

export const TEXTURE_PROGRESSION: readonly TextureStep[] = [
  {
    ageMonths: 4,
    texture: 'Purée lisse, mixée fin, sans morceaux. À la cuillère.',
    examples: ['Purée de carotte mixée', 'Purée de pomme cuite'],
    markers: [
      'Tient sa tête bien droit',
      'Ouvre la bouche à la cuillère',
      'Ne pousse plus la cuillère avec la langue'
    ]
  },
  {
    ageMonths: 6,
    texture: 'Purée lisse → moulinée. Texture homogène, plus consistante.',
    examples: ['Purée légumes + viande mixée', 'Compote de fruits cuits'],
    markers: ['Tient assis avec un soutien', "Manifeste de l'intérêt pour les aliments"]
  },
  {
    ageMonths: 8,
    texture: 'Morceaux très mous et fondants, qui s’écrasent entre les doigts ou sur le palais.',
    examples: ['Banane très mûre', 'Avocat mûr', 'Légumes très cuits'],
    markers: ['Tient sa tête et son dos droits', 'Mâchonne avec les gencives']
  },
  {
    ageMonths: 10,
    texture: 'Morceaux adaptés à croquer et à mâcher, en progressant selon les capacités.',
    examples: ['Petits morceaux de légumes cuits', 'Fruits mûrs', 'Pâtes bien cuites'],
    markers: [
      'Pince entre pouce et index',
      'Porte les aliments à la bouche',
      'Mâchonne efficacement'
    ]
  },
  {
    ageMonths: 12,
    texture:
      "Morceaux variés, repas familiaux adaptés. Découper les aliments à risque d'étouffement.",
    examples: ['Petits dés de légumes', 'Morceaux de fruits mûrs', 'Pâtes, riz, semoule'],
    markers: ['Mâche des textures variées', 'Porte les aliments à la bouche']
  },
  {
    ageMonths: 24,
    texture: 'Toutes textures. Découpes adaptées à la taille de la bouche.',
    examples: ['Plats familiaux moins salés', 'Crudités fines'],
    markers: ['Mange seul avec la cuillère', 'Boit au verre']
  }
];

// ---------------------------------------------------------------------------
// Forbidden / restricted foods
// ---------------------------------------------------------------------------

export type ForbiddenFood = {
  id: string;
  name: string;
  /** Human-readable age gate for the guidance UI ("< 12 mois", "À retarder"). */
  until: string;
  /**
   * Machine-checkable age gate, in months. Set this whenever a numeric upper
   * bound exists so the reminders engine can iterate FORBIDDEN_FOODS instead
   * of hardcoding the threshold separately. Leave undefined when `until` is
   * advisory rather than numeric (e.g. "À retarder le plus possible").
   */
  untilMonths?: number;
  /**
   * Substrings (case-insensitive) to look for in `foodEntries.foodName` when
   * deciding whether to surface a "forbidden food given" reminder. Most
   * forbidden items (sel, sucre) are ingredient-level rather than food-level
   * and so can't be detected from the catalog — leave undefined for those
   * and rely on the guide page to surface them. Honey CAN be detected
   * because parents add it as a custom food.
   */
  nameMatchers?: readonly string[];
  /**
   * Canonical reminder title rendered when the food is detected in entries.
   * Must be set alongside `nameMatchers` and `untilMonths` for the entry to
   * surface as a runtime reminder; the reminders engine silently skips items
   * that have `nameMatchers` but no `reminderTitle` (no enforcement at the
   * type level on purpose — keeps authoring data-only with no synthesis at
   * the call site).
   */
  reminderTitle?: string;
  reason: string;
  sources: SourceId[];
};

export const FORBIDDEN_FOODS: readonly ForbiddenFood[] = [
  {
    id: 'miel',
    name: 'Miel (et produits contenant du miel)',
    until: '< 12 mois',
    untilMonths: 12,
    nameMatchers: ['miel'],
    reminderTitle: 'Miel avant 1 an : à éviter',
    reason:
      'Risque de botulisme infantile (Clostridium botulinum). Aucun miel, même cuit, avant 1 an.',
    sources: ['who-cf', 'anses-nourrisson']
  },
  {
    id: 'lait-cru',
    name: 'Lait cru et fromages au lait cru',
    until: '< 5 ans',
    reason:
      'Risque infectieux (Listeria, EHEC, salmonelle). Exception : fromages à pâte pressée cuite (comté, emmental, beaufort).',
    sources: ['anses-nourrisson']
  },
  {
    id: 'sel',
    name: 'Sel ajouté',
    until: '< 3 ans',
    untilMonths: 36,
    reason:
      'Ne pas saler les plats et limiter les aliments très salés comme la charcuterie et les plats préparés.',
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  {
    id: 'sucre',
    name: 'Sucres ajoutés et produits sucrés',
    until: 'À retarder le plus possible',
    reason:
      'Habituation au goût sucré, risque carie, surpoids. Sodas, jus, biscuits, gâteaux, céréales sucrées à éviter.',
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  {
    id: 'oeuf-cru',
    name: 'Œuf cru ou peu cuit',
    until: '< 5 ans',
    reason:
      'Risque de salmonellose. Pas de mayonnaise maison, mousse au chocolat, œuf coulant, tiramisu.',
    sources: ['hcsp-2020', 'anses-nourrisson']
  },
  {
    id: 'viande-poisson-cru',
    name: 'Viande et poisson crus ou peu cuits',
    until: 'Toujours bien cuits',
    reason:
      'Risque infectieux ou parasitaire. Pas de tartare, sushi, carpaccio ni viande peu cuite.',
    sources: ['anses-nourrisson']
  },
  {
    id: 'boissons-vegetales',
    name: 'Boissons végétales (amande, riz, avoine, soja)',
    until: 'Ne remplacent pas le lait < 3 ans',
    reason:
      'Apports en protéines, calcium, lipides essentiels insuffisants pour un nourrisson : même enrichies.',
    sources: ['anses-nourrisson']
  },
  {
    id: 'noix-entieres',
    name: 'Fruits à coque entiers (cacahuètes, noix, amandes…)',
    until: '< 5 ans',
    reason: "Risque majeur d'étouffement. À donner uniquement en purée fine.",
    sources: ['spf-pnns-guide']
  },
  {
    id: 'jus-fruits',
    name: 'Jus de fruits comme boisson',
    until: 'À limiter, eau en seule boisson',
    reason: "Sucres rapides, peu d'intérêt nutritionnel. Privilégier le fruit entier.",
    sources: ['spf-pnns-guide']
  },
  {
    id: 'sojaboisson-3ans',
    name: 'Produits à base de soja (tofu, yaourts, boissons végétales au soja)',
    until: '< 3 ans',
    reason:
      'Présence de phyto-œstrogènes. HCSP 2020 et ANSES déconseillent les produits à base de soja avant 3 ans (tofu compris).',
    sources: ['hcsp-2020', 'anses-nourrisson']
  }
];

// ---------------------------------------------------------------------------
// Choking hazards
// ---------------------------------------------------------------------------

export type ChokingHazard = {
  food: string;
  rule: string;
};

export const CHOKING_HAZARDS: readonly ChokingHazard[] = [
  { food: 'Raisin', rule: 'Écraser ou couper en 4 dans la longueur, selon les capacités.' },
  { food: 'Tomate cerise', rule: 'Couper en 4 dans la longueur.' },
  { food: 'Saucisse, hot-dog', rule: 'Couper en lamelles dans la longueur, jamais en rondelles.' },
  {
    food: 'Carotte crue, pomme dure',
    rule: "Râper finement ou cuire jusqu'à fondant. Pas de bâtonnets crus avant 4 ans."
  },
  {
    food: 'Fruits à coque entiers (cacahuète, noix, amande)',
    rule: 'Interdits avant 5 ans. Uniquement en purée fine.'
  },
  { food: 'Bonbons durs, chewing-gum', rule: 'Pas avant 5 ans.' },
  { food: 'Pop-corn', rule: 'Pas avant 5 ans.' },
  {
    food: 'Cuillère de beurre de cacahuète pure',
    rule: 'Diluer dans une purée : peut coller au palais.'
  },
  { food: 'Gros morceaux de viande', rule: 'Hacher ou couper en petits morceaux fondants.' },
  { food: 'Olive entière, cerise avec noyau', rule: 'Dénoyauter et couper.' }
];

// ---------------------------------------------------------------------------
// Reaction guidance
// ---------------------------------------------------------------------------

export type ReactionGuidance = {
  level: 'inconfort' | 'reaction';
  title: string;
  signs: string[];
  whatToDo: string;
  sources: SourceId[];
};

export const REACTION_GUIDANCE: readonly ReactionGuidance[] = [
  {
    level: 'inconfort',
    title: 'Symptôme léger après un aliment',
    signs: [
      'Rougeur autour de la bouche ou petite plaque localisée',
      'Urticaire localisée',
      'Vomissement isolé peu après la prise',
      'Symptôme digestif inhabituel et reproductible'
    ],
    whatToDo:
      'Arrêter l’aliment, noter l’heure et les symptômes, puis demander rapidement un avis médical avant de le reproposer. Surveiller l’apparition d’autres signes.',
    sources: ['ameli-allergie', 'ameli-oedeme']
  },
  {
    level: 'reaction',
    title: 'Symptômes pouvant évoquer une réaction allergique',
    signs: [
      'Urticaire (plaques rouges et démangeaisons) localisée ou diffuse',
      'Œdème des lèvres, des paupières, du visage',
      'Vomissements répétés peu après la prise',
      'Diarrhée importante',
      'Toux sèche persistante, voix modifiée, sifflement',
      'Pâleur, hypotonie, somnolence inhabituelle'
    ],
    whatToDo:
      'Arrêter immédiatement l’aliment. En cas de gêne respiratoire, d’œdème des lèvres ou de la langue, de malaise, ou de plusieurs symptômes associés, **appeler le 15 ou le 112 sans attendre**. Ne pas réintroduire sans avis médical.',
    sources: ['ameli-allergie', 'ameli-oedeme']
  }
];

export const EMERGENCY_NUMBER = '15 (SAMU) ou 112';

// ---------------------------------------------------------------------------
// DME / approaches
// ---------------------------------------------------------------------------

export const APPROACHES = {
  classique: {
    title: 'Diversification classique',
    body: 'On démarre par des purées à la cuillère puis on fait évoluer rapidement les textures selon les capacités de l’enfant.',
    pros: ['Quantités faciles à ajuster', 'Progression graduelle des textures'],
    cons: ['Transition aux morceaux à anticiper'],
    sources: ['spf-pnns-guide', 'sfp-dme'] as SourceId[]
  },
  dme: {
    title: "Diversification menée par l'enfant (DME / BLW)",
    body: "Vers 6 mois, lorsque bébé tient bien assis, attrape et porte à la bouche, il peut se servir de morceaux adaptés. Position SFP : pas de préférence par rapport à la diversification classique, attention à l'apport en fer et à la sécurité.",
    pros: ['Autonomie', 'Repas familiaux partagés', 'Découverte des textures'],
    cons: [
      "Risque d'apport insuffisant en fer, zinc, énergie si mal cadré",
      'Surveillance permanente indispensable',
      'Nécessite des capacités motrices et oro-motrices suffisantes ; demander un avis professionnel en cas de doute'
    ],
    sources: ['sfp-dme'] as SourceId[]
  },
  mixte: {
    title: 'Approche mixte',
    body: 'Combiner cuillère parentale et morceaux fondants pris à la main, selon les capacités de l’enfant.',
    pros: ['Flexibilité', 'Permet de varier les textures', 'Permet de partager les repas'],
    cons: ["Nécessite d'adapter les textures à chaque âge"],
    sources: ['sfp-dme', 'spf-pnns-guide'] as SourceId[]
  }
} as const;

// ---------------------------------------------------------------------------
// Tips pool (rotated contextually)
// ---------------------------------------------------------------------------

export type Tip = {
  id: string;
  body: string;
  stages?: StageId[];
  categories?: CategoryId[];
  allergens?: AllergenId[];
  sources?: SourceId[];
};

export const TIPS: readonly Tip[] = [
  {
    id: 'repeat-10',
    body: "Reproposez un aliment refusé jusqu'à 10 fois : l'acceptation gustative se construit avec la répétition, sans forcer.",
    sources: ['spf-pnns-guide']
  },
  {
    id: 'add-fats',
    body: "Ajoutez au total une cuillère à café d'huile crue par jour avant 1 an, puis deux cuillères à café par jour de 1 à 3 ans.",
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  {
    id: 'no-salt',
    body: 'Pas de sel ajouté avant 3 ans ; limitez aussi la charcuterie et les plats préparés.',
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  {
    id: 'no-sugar',
    body: 'Reportez le plus longtemps possible les produits sucrés. Bébé apprécie naturellement les vrais goûts.',
    sources: ['spf-pnns-guide']
  },
  {
    id: 'iron-6m',
    body: 'Avant 1 an, proposez chaque jour 10 g au total de viande, poisson ou œuf, en variant les sources de fer.',
    stages: ['6-9'],
    sources: ['hcsp-2020']
  },
  {
    id: 'milk-stays',
    body: 'Le lait maternel ou infantile reste l’aliment principal jusqu’à 1 an : environ 500 mL/jour de lait infantile entre 6 et 12 mois.',
    stages: ['4-6', '6-9', '9-12'],
    sources: ['hcsp-2020']
  },
  {
    id: 'allergens-window',
    body: 'Une fois la diversification commencée entre 4 et 6 mois, ne retardez pas les allergènes. La prévention est surtout étayée pour l’œuf bien cuit et l’arachide.',
    stages: ['4-6', '6-9'],
    sources: ['hcsp-2020', 'eaaci-2020', 'leap-2015']
  },
  {
    id: 'peanut-form',
    body: 'Beurre de cacahuète lisse dilué dans une purée ou un yaourt : jamais de cacahuète entière avant 5 ans.',
    allergens: ['arachide'],
    sources: ['leap-2015']
  },
  {
    id: 'egg-fully-cooked',
    body: "Toujours œuf bien cuit (jaune et blanc fermes). Pas d'œuf coulant ni de mayo maison avant 5 ans.",
    allergens: ['oeuf'],
    sources: ['hcsp-2020', 'anses-nourrisson']
  },
  {
    id: 'no-honey',
    body: 'Pas de miel avant 12 mois : risque de botulisme infantile.',
    stages: ['4-6', '6-9', '9-12'],
    sources: ['who-cf']
  },
  {
    id: 'fish-2x',
    body: 'Poisson 2 fois par semaine, dont un gras (saumon, sardine, maquereau) pour les oméga-3.',
    categories: ['poissons'],
    sources: ['anses-nourrisson']
  },
  {
    id: 'maintain-allergens',
    body: 'Une fois un allergène toléré, continuez à le proposer régulièrement, au moins chaque semaine.',
    sources: ['ascia-2026']
  },
  {
    id: 'one-novelty',
    body: 'Pour un allergène courant, introduisez un seul nouvel allergène par repas. Les autres aliments peuvent être variés sans calendrier d’attente fixe.',
    stages: ['4-6'],
    sources: ['ascia-2026', 'hcsp-2020']
  },
  {
    id: 'sit-up',
    body: 'Bébé mange assis bien droit, dans une chaise haute adaptée : jamais en voiture, en poussette ou allongé.',
    sources: ['sfp-dme']
  },
  {
    id: 'choking-cut',
    body: 'Coupez raisins et tomates cerises en 4 dans la longueur, et la saucisse en lamelles : pas en rondelles.',
    stages: ['9-12', '12-36'],
    sources: ['spf-pnns-guide']
  },
  {
    id: 'finger-foods',
    body: "Vers 9 mois : proposez des bâtonnets de légumes cuits ou de l'avocat mûr en lamelles. Bébé pince et porte à la bouche.",
    stages: ['9-12'],
    sources: ['spf-pnns-guide']
  },
  {
    id: 'category-balance',
    body: 'Variez les groupes sur la journée et la semaine ; les légumineuses sont à proposer au moins 2 fois par semaine après 1 an.',
    sources: ['spf-pnns-guide']
  },
  {
    id: 'water',
    body: "Proposez régulièrement de l'eau, surtout dès l'apparition des morceaux. Eau en seule boisson.",
    stages: ['6-9', '9-12', '12-36'],
    sources: ['spf-pnns-guide']
  },
  {
    id: 'satiety',
    body: "Si bébé détourne la tête, ferme la bouche ou repousse la cuillère, c'est qu'il a fini. Ne jamais forcer.",
    sources: ['spf-pnns-guide']
  },
  {
    id: 'gluten-progressive',
    body: "Le gluten s'introduit entre 4 et 12 mois, en quantités progressives : pas une grosse portion d'emblée.",
    allergens: ['gluten'],
    sources: ['espghan-2017']
  },
  {
    id: 'raw-cheese',
    body: 'Pas de fromages au lait cru avant 5 ans (sauf pâte pressée cuite type comté, emmental).',
    sources: ['anses-nourrisson']
  },
  {
    id: 'spices',
    body: 'Aromates et épices douces (persil, basilic, cumin, paprika doux, curcuma) enrichissent les goûts sans saler.',
    sources: ['spf-pnns-guide']
  },
  {
    id: 'neophobia',
    body: 'Vers 18–24 mois : la néophobie alimentaire est normale. Continuez à proposer sans forcer : ça passe.',
    stages: ['12-36'],
    sources: ['spf-pnns-guide']
  },
  {
    id: 'family-table',
    body: "Mangez à table avec bébé. L'imitation est un moteur puissant de l'acceptation.",
    sources: ['spf-pnns-guide']
  },
  {
    id: 'eat-study',
    body: 'Dans l’étude EAT, l’analyse principale n’a pas montré de baisse significative ; une baisse a été observée chez les enfants ayant suivi le protocole d’introduction de 6 allergènes.',
    stages: ['4-6'],
    sources: ['eat-2016']
  },
  {
    id: 'leap-study',
    body: 'Dans l’étude LEAP, chez des bébés à haut risque, l’introduction précoce de l’arachide a réduit le risque jusqu’à 86 % dans un sous-groupe.',
    stages: ['4-6', '6-9'],
    sources: ['leap-2015']
  },
  {
    id: 'high-risk-eczema',
    body: "Si bébé a un eczéma sévère ou une allergie à l'œuf : consultez un allergologue avant d'introduire l'arachide.",
    allergens: ['arachide'],
    sources: ['leap-2015', 'espghan-2017']
  },
  {
    id: 'no-cow-milk',
    body: 'Le lait de vache liquide ne remplace pas le lait infantile avant 1 an : apport en fer insuffisant.',
    allergens: ['lait'],
    sources: ['hcsp-2020']
  },
  {
    id: 'mercury-fish',
    body: 'Avant 3 ans, évitez espadon, marlin, siki, requin et lamproie ; limitez les autres poissons sauvages prédateurs.',
    categories: ['poissons'],
    sources: ['anses-nourrisson']
  }
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getStageForAgeMonths(months: number): Stage {
  for (const s of STAGES) {
    if (months >= s.ageMin && months < s.ageMax) return s;
  }
  return months < 4 ? STAGES[0] : STAGES[STAGES.length - 1];
}

export type TipContext = {
  stageId?: StageId;
  categoryId?: CategoryId;
  allergenId?: AllergenId;
  ageMonths?: number;
};

export function getTipsFor(ctx: TipContext): Tip[] {
  const stageId =
    ctx.stageId ?? (ctx.ageMonths != null ? getStageForAgeMonths(ctx.ageMonths).id : undefined);

  const matches = TIPS.filter((t) => {
    if (ctx.allergenId && t.allergens?.includes(ctx.allergenId)) return true;
    if (ctx.categoryId && t.categories?.includes(ctx.categoryId)) return true;
    if (stageId && t.stages?.includes(stageId)) return true;
    return false;
  });

  // Always add a small pool of universal tips (no stage/category/allergen filter)
  const universal = TIPS.filter((t) => !t.stages && !t.categories && !t.allergens);
  return [...matches, ...universal];
}

/**
 * Deterministic daily-rotating tip picker : same parents on the same day see
 * the same tip. Stable across reloads, refreshes once per day.
 */
export function pickRotatingTip(tips: Tip[], seed: number): Tip | null {
  if (tips.length === 0) return null;
  const day = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
  const idx = (((day + seed) % tips.length) + tips.length) % tips.length;
  return tips[idx];
}

// ---------------------------------------------------------------------------
// Bento helper
// ---------------------------------------------------------------------------

export type BentoStage = {
  id: StageId;
  title: string;
  oneLiner: string;
  principles: string[];
  focus: string[];
  textures: string;
  milkTarget: string;
  redFlags: string[];
  sources: string[];
};

/**
 * Returns all 4 canonical stages in the shape expected by DiscoverBento /
 * StagesBentoGrid. Derives directly from STAGES : no new content authored.
 */
export function getAllStagesForBento(): BentoStage[] {
  return STAGES.map((s) => ({
    id: s.id,
    title: s.title,
    oneLiner: s.oneLiner,
    principles: [...s.principles],
    focus: [...s.focus],
    textures: s.textures,
    milkTarget: s.milkTarget,
    redFlags: [...s.redFlags],
    sources: [...s.sources]
  }));
}
