// Single source of truth for all in-app diversification guidance (FR).
// Every claim that comes from an official guideline carries SourceId(s).
// Edited by hand; UI templates should never duplicate this copy.

import type { AllergenId } from '$lib/utils/allergens';
import type { CategoryId } from '$lib/utils/categories';
import type { SourceId } from './sources';
import { ALL_SOURCE_IDS } from './sources';

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
      "On lance la diversification entre 4 mois révolus et 6 mois, dès que bébé tient sa tête, s'intéresse au repas et ouvre la bouche.",
    principles: [
      'Une nouvelle saveur à la fois, en petite quantité (cuillères), au moment du repas familial.',
      'Tous les groupes peuvent être proposés, y compris les allergènes : gluten, œuf, arachide en purée, lait sous forme de yaourt/fromage.',
      "Le lait (maternel ou infantile) reste l'aliment principal : environ 600–800 mL/jour.",
      'Ne pas saler, ne pas sucrer, ajouter une cuillère de matière grasse aux préparations maison.'
    ],
    focus: [
      'Légumes cuits écrasés ou en purée lisse (carotte, courgette épluchée, patate douce, potiron, panais).',
      'Fruits cuits ou bien mûrs en purée (pomme, poire, banane, avocat).',
      'Premières protéines vers 6 mois : viande / poisson / œuf bien cuit / légumineuses bien cuites.',
      "Premiers allergènes en purée lisse : œuf bien cuit, beurre de cacahuète dilué, purée d'amande."
    ],
    textures: 'Purée lisse, sans morceaux. À la cuillère.',
    milkTarget: 'Lait maternel à la demande, ou ~600–800 mL de lait infantile / jour.',
    redFlags: [
      'Ne pas démarrer avant 4 mois révolus (système digestif et rénal immatures).',
      'Ne pas dépasser 6 mois sans diversifier (risque de carence en fer, fenêtre allergique).'
    ],
    sources: ['spf-pnns-guide', 'hcsp-2020', '1000-jours', 'espghan-2017']
  },
  {
    id: '6-9',
    ageMin: 6,
    ageMax: 9,
    title: '6–9 mois · On élargit, on apporte du fer',
    oneLiner:
      "On introduit toutes les familles d'aliments. Priorité au fer : viande, poisson, œuf, légumineuses dès 6 mois.",
    principles: [
      'Tous les groupes en routine : légumes, fruits, féculents, légumineuses, viande, poisson, œuf, produits laitiers, allergènes.',
      'Augmenter progressivement la quantité ; passer à 4 repas (matin, midi, goûter, soir).',
      "Continuer à proposer un aliment refusé jusqu'à ~10 fois : l'acceptation gustative se construit.",
      "Toujours ajouter des matières grasses crues à la fin de la cuisson (huile de colza, huile de noix, huile d'olive ; beurre en petite quantité possible)."
    ],
    focus: [
      'Viande / poisson : 10–20 g par jour (≈ 2 cuillères à café). Poisson 2 fois par semaine dont un gras (saumon, sardine).',
      "Œuf entier bien cuit (jaune + blanc) : ~1/4 d'œuf, à augmenter après 1 an (1/3 entre 1–2 ans, 1/2 entre 2–3 ans).",
      "Allergènes : à 6–9 mois, terminer l'introduction des allergènes courants à cet âge (œuf, arachide, fruits à coque en purée, sésame, gluten, poisson, lait). Le soja n'est pas dans cette liste : HCSP 2020 et ANSES déconseillent les produits à base de soja avant 3 ans.",
      'Légumineuses cuites bien écrasées (lentilles corail, pois chiches, haricots blancs).'
    ],
    textures:
      'Mouliné fin → écrasé fondant. Premiers petits morceaux fondants vers 8 mois (banane, avocat, courgette cuite).',
    milkTarget: 'Lait maternel à la demande ou ~500 mL/jour de lait 2ᵉ âge.',
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
      'Bébé mâchonne, pince entre pouce et index, peut tenir un morceau dans la main. On évolue vers des textures plus riches et des finger foods sécurisés.',
    principles: [
      'Petits morceaux fondants, finger foods : bâtonnets de légumes bien cuits, morceaux de fruits mûrs, pâtes bien cuites.',
      'Repas en commun à table familiale ; bébé observe et imite.',
      'Continuer la diversification : épices douces (cumin, paprika doux, curcuma, herbes fraîches).',
      "Proposer l'eau dans un petit verre / une paille."
    ],
    focus: [
      'Variété de céréales et féculents (riz, pâtes, semoule, polenta, sarrasin, quinoa, pomme de terre).',
      'Fromages variés (à pâte pressée cuite type comté, emmental ; pâtes molles type camembert pasteurisé).',
      "Continuer l'exposition régulière aux allergènes déjà introduits : la tolérance s'entretient."
    ],
    textures:
      'Petits morceaux fondants ; finger foods (bâtonnets, lamelles). Toujours sous surveillance.',
    milkTarget: "~500 mL/jour de lait 2ᵉ âge ou poursuite de l'allaitement.",
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
      'Repas familiaux adaptés : moins de sel, pas de sucre ajouté, gras de qualité.',
      'Maintenir la variété : un aliment de chaque groupe à chaque repas idéalement.',
      "Lait de croissance ou poursuite de l'allaitement, ou ≥ 500 mL d'équivalents laitiers.",
      'Continuer à proposer les aliments refusés : la fenêtre néophobique (~18–24 mois) est normale.'
    ],
    focus: [
      'Poisson 2 fois par semaine dont un gras.',
      'Légumes et fruits à chaque repas, frais ou surgelés natures.',
      "Viande, poisson ou œuf : ~30 g/jour à 1 an, jusqu'à 50 g vers 3 ans.",
      'Eau à volonté, en seule boisson.'
    ],
    textures: 'Toutes textures, en morceaux adaptés à la taille de la bouche.',
    milkTarget: '~500 mL/jour de lait de croissance ou équivalents laitiers.',
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
    body: "Pas avant 4 mois (digestion et reins immatures). Pas après 6 mois (risque de carence en fer, fenêtre de tolérance allergique). On démarre quand bébé tient sa tête, s'intéresse au repas, ouvre la bouche à la cuillère.",
    sources: ['hcsp-2020', 'spf-pnns-guide', '1000-jours']
  },
  {
    id: 'allergens-early',
    title: 'Introduire les allergènes tôt et sans tarder',
    body: "Dès que la diversification est lancée, proposer œuf bien cuit, arachide (en purée fine), lait (yaourt/fromage), gluten, poisson, fruits à coque (en purée), sésame. L'introduction précoce réduit le risque d'allergie alimentaire (LEAP, EAT). Le soja n'entre pas dans cette liste : HCSP 2020 et ANSES déconseillent les produits à base de soja avant 3 ans.",
    sources: ['leap-2015', 'eat-2016', 'espghan-2017', 'hcsp-2020']
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
    body: "Une cuillère d'huile de colza, d'huile d'olive ou une noix de beurre cru à la fin de la cuisson, dans chaque préparation maison. Apporte des acides gras essentiels au développement cérébral.",
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
    title: 'Pas de sel ajouté avant 1 an',
    body: 'Les reins du nourrisson éliminent mal le sel (besoins < 1 g/jour). Ne pas saler les plats, éviter charcuterie, fromages très salés, plats préparés.',
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
    body: 'Lait maternel à la demande ou lait infantile (~500 mL/jour à 6 mois). La diversification complète, elle ne remplace pas.',
    sources: ['hcsp-2020', 'who-cf']
  },
  {
    id: 'cook-thoroughly',
    title: 'Cuissons à cœur',
    body: 'Viande, poisson, œuf : toujours bien cuits (pas de tartare, sushi, œuf coulant, mayo maison). Risque de listeria, salmonelle, toxoplasmose.',
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
  recommendedAgeMonths: number;
  why: string;
  howToOffer: string[];
  firstSigns: string[];
  severeSigns: string[];
  whatToDo: string;
  sources: SourceId[];
};

export const ALLERGEN_GUIDANCE: Record<AllergenId, AllergenGuidance> = {
  oeuf: {
    id: 'oeuf',
    recommendedAgeMonths: 6,
    why: "L'œuf est l'un des allergènes majeurs chez l'enfant. Une introduction précoce, dès 4–6 mois, réduit significativement le risque d'allergie (étude EAT).",
    howToOffer: [
      'Œuf entier bien cuit (jaune et blanc), durs ou en omelette bien cuite.',
      "~1/4 d'œuf entier (jaune + blanc) écrasé dans une purée à 6–12 mois, puis ~1/3 à 1–2 ans, puis ~1/2 à 2–3 ans (HCSP 2020).",
      "Pas d'œuf cru (mayo maison, mousse au chocolat) avant 3 ans."
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
      'Signes légers : arrêter, noter, consulter le médecin avant la prochaine exposition. Signes sévères : appeler le 15 immédiatement.',
    sources: ['eat-2016', 'espghan-2017', 'hcsp-2020']
  },
  arachide: {
    id: 'arachide',
    recommendedAgeMonths: 6,
    why: "L'introduction précoce de l'arachide dès 4–11 mois réduit jusqu'à 86 % le risque d'allergie chez les nourrissons à risque (étude LEAP). À introduire chez tous les enfants.",
    howToOffer: [
      'Beurre de cacahuète **lisse** (sans morceaux) dilué dans une purée, un yaourt ou un peu de lait.',
      'Commencer par une demi-cuillère à café diluée, puis augmenter.',
      '**Jamais** de cacahuètes entières avant 5 ans (étouffement).',
      "Si bébé a un eczéma sévère ou une allergie à l'œuf : consulter un allergologue **et** introduire dans la fenêtre 4–11 mois après évaluation (ESPGHAN 2017). Ne pas retarder au-delà."
    ],
    firstSigns: ['Rougeurs locales', 'Démangeaisons buccales', "Plaques d'urticaire"],
    severeSigns: [
      'Œdème de la gorge, voix modifiée',
      'Difficulté respiratoire, sifflement',
      'Pâleur, perte de tonus, vomissements répétés'
    ],
    whatToDo:
      "Signes légers : arrêter et consulter avant ré-exposition. Signes sévères / suspicion d'anaphylaxie : 15 immédiatement.",
    sources: ['leap-2015', 'espghan-2017']
  },
  lait: {
    id: 'lait',
    recommendedAgeMonths: 6,
    why: "Les protéines de lait de vache font partie des allergènes majeurs. L'introduction sous forme transformée (yaourt, fromage) dès 6 mois est recommandée.",
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
      "Signes légers : noter, arrêter, consulter. Signes sévères : 15. Si APLV connue, suivre l'éviction prescrite.",
    sources: ['hcsp-2020', 'espghan-2017']
  },
  gluten: {
    id: 'gluten',
    recommendedAgeMonths: 6,
    why: "Le gluten s'introduit entre 4 et 12 mois. Éviter de très grandes quantités d'emblée : introduire progressivement.",
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
    sources: ['espghan-2017', 'hcsp-2020']
  },
  fruits_a_coque: {
    id: 'fruits_a_coque',
    recommendedAgeMonths: 6,
    why: 'Les fruits à coque (amande, noisette, noix de cajou, noix) sont des allergènes majeurs. Introduction précoce recommandée : uniquement en purée fine.',
    howToOffer: [
      "Purée d'amande / de noisette / de cajou (rayon bio ou allégés sans sucre), diluée dans une purée ou un yaourt.",
      '**Jamais** de fruit à coque entier avant 5 ans (étouffement) : toujours sous forme de purée fine.'
    ],
    firstSigns: ['Rougeurs', 'Démangeaisons buccales', 'Urticaire localisée'],
    severeSigns: ['Œdème, gêne respiratoire, urticaire généralisée'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['espghan-2017', 'hcsp-2020']
  },
  sesame: {
    id: 'sesame',
    recommendedAgeMonths: 6,
    why: 'Le sésame est devenu un allergène majeur, à introduire dès la diversification.',
    howToOffer: [
      'Tahin (purée de sésame) dilué dans une purée ou un houmous écrasé.',
      'Pas de graines de sésame entières avant que la mastication soit acquise.'
    ],
    firstSigns: ['Rougeurs locales', 'Urticaire'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['eat-2016', 'espghan-2017']
  },
  soja: {
    id: 'soja',
    recommendedAgeMonths: 36,
    why: "Le soja contient des phyto-œstrogènes. HCSP 2020 et ANSES déconseillent les produits à base de soja avant 3 ans (tofu, boissons végétales, yaourts au soja). Le soja n'est pas un allergène à introduction prioritaire dans la fenêtre 4–11 mois ; il est suivi ici pour la complétude du carnet, pas en tant qu'allergène à introduire tôt.",
    howToOffer: [
      'Avant 3 ans : éviter les produits à base de soja (tofu, yaourts au soja, boissons végétales au soja).',
      'Les boissons végétales au soja ne remplacent jamais le lait infantile.',
      'Si introduction après 3 ans : tofu nature bien cuit, en petite quantité.'
    ],
    firstSigns: ['Diarrhée, vomissements', "Plaques d'urticaire"],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['hcsp-2020', 'anses-nourrisson']
  },
  poisson: {
    id: 'poisson',
    recommendedAgeMonths: 6,
    why: 'Le poisson est riche en oméga-3 (DHA), essentiel au développement cérébral. À proposer 2 fois par semaine, dont un poisson gras.',
    howToOffer: [
      'Cabillaud, sole, merlu, saumon, sardine, maquereau, truite : bien cuits, sans arêtes.',
      'Varier les espèces. Limiter les gros prédateurs (espadon, requin, marlin) : méthylmercure.',
      'Privilégier les petits poissons gras (sardine, maquereau) plutôt que le thon.'
    ],
    firstSigns: ['Rougeurs autour de la bouche', 'Urticaire'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['anses-nourrisson', 'hcsp-2020']
  },
  crustace: {
    id: 'crustace',
    recommendedAgeMonths: 12,
    why: 'Les crustacés peuvent être introduits dès la fin de la 1ʳᵉ année : sans urgence, sous formes adaptées.',
    howToOffer: [
      'Petits morceaux de crevette, langoustine, crabe bien cuits.',
      "Bien vérifier l'absence de coquille / fragments durs."
    ],
    firstSigns: ['Démangeaisons', 'Urticaire'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['anses-nourrisson']
  },
  mollusque: {
    id: 'mollusque',
    recommendedAgeMonths: 12,
    why: 'Les mollusques (moules, huîtres, coquilles Saint-Jacques) sont des allergènes majeurs.',
    howToOffer: [
      'Coquille Saint-Jacques bien cuite, finement coupée.',
      'Éviter les huîtres crues avant plusieurs années (risque infectieux).'
    ],
    firstSigns: ['Rougeurs', 'Urticaire'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['anses-nourrisson']
  },
  celeri: {
    id: 'celeri',
    recommendedAgeMonths: 6,
    why: 'Le céleri (rave et branche) est un allergène majeur, fréquemment associé aux allergies aux pollens.',
    howToOffer: [
      'Céleri-rave cuit, écrasé en purée mélangée à un autre légume.',
      'Petits morceaux fondants ensuite.'
    ],
    firstSigns: ['Démangeaisons buccales', 'Rougeurs'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['anses-nourrisson']
  },
  moutarde: {
    id: 'moutarde',
    recommendedAgeMonths: 9,
    why: 'Allergène majeur en France et en Europe, à introduire prudemment dans des préparations.',
    howToOffer: [
      'Une pointe de moutarde douce dans une vinaigrette ou un plat à partir de 9–12 mois.',
      'Pas de moutarde forte avant plusieurs années.'
    ],
    firstSigns: ['Démangeaisons buccales', 'Rougeurs'],
    severeSigns: ['Œdème, gêne respiratoire'],
    whatToDo: 'Signes légers : arrêter et consulter. Signes sévères : 15.',
    sources: ['anses-nourrisson']
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
    cadence: 'À chaque repas du midi et du soir.',
    examples: ['Carotte', 'Courgette épluchée', 'Patate douce', 'Potiron', 'Panais', 'Brocoli'],
    sources: ['spf-pnns-guide']
  },
  fruits: {
    id: 'fruits',
    why: 'Vitamines, fibres, hydratation. Goûts naturellement appréciés.',
    whenStart: 'Dès 4 mois, en purée ou bien mûrs et écrasés.',
    cadence: 'Au goûter principalement, parfois en dessert.',
    examples: ['Pomme', 'Poire', 'Banane', 'Avocat', 'Pêche'],
    sources: ['spf-pnns-guide']
  },
  feculents: {
    id: 'feculents',
    why: 'Apport en énergie. Indispensables pour soutenir la croissance.',
    whenStart: 'Riz et pomme de terre dès 4 mois ; pâtes/pain (gluten) dès 6 mois.',
    cadence: 'Un féculent à chaque repas principal.',
    examples: ['Riz', 'Semoule', 'Pâtes bien cuites', 'Quinoa', 'Polenta'],
    sources: ['spf-pnns-guide', 'espghan-2017']
  },
  legumineuses: {
    id: 'legumineuses',
    why: 'Protéines végétales et fer. Excellent complément à la viande.',
    whenStart: 'Dès 6 mois, bien cuites et écrasées (lentilles corail en purée).',
    cadence: '1–2 fois par semaine, en alternance avec viande/poisson.',
    examples: ['Lentilles corail', 'Pois chiches', 'Haricots blancs', 'Fèves'],
    sources: ['spf-pnns-guide']
  },
  viandes: {
    id: 'viandes',
    why: 'Apport majeur en fer (forme bien assimilée), zinc, vitamine B12.',
    whenStart: 'Dès 6 mois, mixée puis hachée.',
    cadence: "~10–20 g/jour à 6 mois, jusqu'à 30 g à 1 an.",
    examples: ['Poulet', 'Dinde', 'Bœuf', 'Veau', 'Agneau'],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  poissons: {
    id: 'poissons',
    why: 'Oméga-3 (DHA) essentiels au cerveau, iode, vitamine D.',
    whenStart: 'Dès 6 mois.',
    cadence: '2 fois par semaine, dont un gras (saumon, sardine, maquereau).',
    examples: ['Cabillaud', 'Saumon', 'Sole', 'Sardine'],
    sources: ['anses-nourrisson', 'hcsp-2020']
  },
  oeufs: {
    id: 'oeufs',
    why: 'Protéines complètes, fer, vitamines. Allergène majeur à introduire tôt.',
    whenStart: 'Dès 6 mois, œuf entier bien cuit.',
    cadence: '2–3 fois par semaine en alternance avec viande/poisson.',
    examples: ['Œuf dur écrasé', 'Omelette bien cuite', 'Œuf brouillé'],
    sources: ['eat-2016', 'espghan-2017']
  },
  produits_laitiers: {
    id: 'produits_laitiers',
    why: "Calcium, protéines. Le lait reste l'aliment principal jusqu'à 1 an.",
    whenStart:
      'Yaourt nature, fromage blanc dès 6 mois. Lait de vache **liquide** : pas avant 1 an.',
    cadence: '2–3 produits laitiers par jour en plus du lait infantile.',
    examples: ['Yaourt nature', 'Fromage blanc', 'Comté', 'Camembert pasteurisé'],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  allergenes: {
    id: 'allergenes',
    why: "Catégorie pivot : ces aliments sont à introduire tôt pour réduire le risque d'allergie (LEAP, EAT).",
    whenStart: 'Dès 4–6 mois, en formes adaptées (purée fine).',
    cadence:
      "Une fois introduit, **maintenir l'exposition régulière** (1–2 fois par semaine) pour entretenir la tolérance.",
    examples: ['Beurre de cacahuète lisse', "Purée d'amande", 'Tahin (sésame)', 'Œuf bien cuit'],
    sources: ['leap-2015', 'eat-2016', 'espghan-2017']
  },
  matieres_grasses: {
    id: 'matieres_grasses',
    why: 'Acides gras essentiels au développement cérébral. À ajouter systématiquement aux préparations maison.',
    whenStart: 'Dès le démarrage de la diversification.',
    cadence: 'Une cuillère à café à chaque repas principal.',
    examples: ['Huile de colza', "Huile d'olive", 'Beurre cru', 'Huile de noix'],
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  aromates: {
    id: 'aromates',
    why: 'Diversifier les goûts sans saler. Habituer bébé à la richesse aromatique.',
    whenStart: 'Dès 6 mois.',
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
    ageMonths: 7,
    texture: 'Mouliné fin → écrasé fondant à la fourchette.',
    examples: ['Légumes écrasés + huile', 'Poulet haché + carotte écrasée'],
    markers: ['Tient assis seul brièvement', 'Mâchonne avec les gencives']
  },
  {
    ageMonths: 9,
    texture: 'Petits morceaux fondants. Premiers finger foods sécurisés.',
    examples: ['Bâtonnets de courgette cuite', "Lamelles d'avocat mûr", 'Pâtes bien cuites'],
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
    markers: ['Bouche fermée pendant la mastication', 'Coordination main-bouche maîtrisée']
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
  until: string;
  reason: string;
  sources: SourceId[];
};

export const FORBIDDEN_FOODS: readonly ForbiddenFood[] = [
  {
    id: 'miel',
    name: 'Miel (et produits contenant du miel)',
    until: '< 12 mois',
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
    until: '< 12 mois',
    reason:
      'Reins immatures (besoins < 1 g/jour). Ne pas saler les plats, éviter charcuterie et plats préparés.',
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
    until: '< 3 ans',
    reason:
      'Risque de salmonellose. Pas de mayonnaise maison, mousse au chocolat, œuf coulant, tiramisu.',
    sources: ['hcsp-2020', 'anses-nourrisson']
  },
  {
    id: 'viande-poisson-cru',
    name: 'Viande et poisson crus ou peu cuits',
    until: 'Toujours bien cuits',
    reason:
      'Risque listeria, salmonelle, toxoplasmose, anisakis. Pas de tartare, sushi, carpaccio, viande rosée.',
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
  { food: 'Raisin', rule: "Couper en 4 dans la longueur jusqu'à au moins 4 ans." },
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
};

export const REACTION_GUIDANCE: readonly ReactionGuidance[] = [
  {
    level: 'inconfort',
    title: 'Inconfort digestif ou cutané léger',
    signs: [
      'Régurgitation un peu plus marquée',
      'Selles molles ou plus nombreuses sur 24 h',
      'Rougeur autour de la bouche, légère plaque sur le menton',
      'Inconfort transitoire (gaz, ronchonnements)'
    ],
    whatToDo:
      "Noter l'aliment et le contexte. Ne pas conclure trop vite : réintroduire à distance, en petite quantité, sur un repas sans nouveauté. Si récidive systématique, en parler au pédiatre."
  },
  {
    level: 'reaction',
    title: 'Réaction allergique probable',
    signs: [
      'Urticaire (plaques rouges et démangeaisons) localisée ou diffuse',
      'Œdème des lèvres, des paupières, du visage',
      'Vomissements répétés peu après la prise',
      'Diarrhée importante',
      'Toux sèche persistante, voix modifiée, sifflement',
      'Pâleur, hypotonie, somnolence inhabituelle'
    ],
    whatToDo:
      "Arrêter immédiatement l'aliment. Consulter rapidement (médecin, urgences). En cas de signes respiratoires, d'œdème de la gorge, de malaise, **appeler le 15 sans attendre** : il peut s'agir d'une anaphylaxie. Ne pas réintroduire l'aliment sans avis médical."
  }
];

export const EMERGENCY_NUMBER = '15 (SAMU)';

// ---------------------------------------------------------------------------
// DME / approaches
// ---------------------------------------------------------------------------

export const APPROACHES = {
  classique: {
    title: 'Diversification classique',
    body: 'On démarre par des purées lisses à la cuillère puis on évolue vers des morceaux. Approche maîtrisée, recommandée par défaut.',
    pros: [
      'Apport en fer plus contrôlé',
      'Quantités quantifiables',
      'Bien étudiée scientifiquement'
    ],
    cons: ['Transition aux morceaux à anticiper'],
    sources: ['spf-pnns-guide', 'sfp-dme'] as SourceId[]
  },
  dme: {
    title: "Diversification menée par l'enfant (DME / BLW)",
    body: "Bébé mange à la table familiale dès 6 mois en se servant lui-même de morceaux adaptés. Position SFP : pas de préférence par rapport à la diversification classique, attention à l'apport en fer et à la sécurité.",
    pros: ['Autonomie', 'Repas familiaux partagés', 'Découverte des textures'],
    cons: [
      "Risque d'apport insuffisant en fer, zinc, énergie si mal cadré",
      'Surveillance permanente indispensable',
      "À éviter en cas d'antécédent respiratoire ou de retard moteur"
    ],
    sources: ['sfp-dme'] as SourceId[]
  },
  mixte: {
    title: 'Approche mixte',
    body: "Combiner cuillère parentale et morceaux pris à la main. C'est en pratique l'approche la plus fréquente et celle qui sécurise les apports nutritionnels.",
    pros: ['Flexibilité', 'Couvre les besoins en fer/énergie', 'Permet de partager les repas'],
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
    body: "Ajoutez une cuillère d'huile de colza ou d'olive crue à chaque préparation maison. Indispensable pour le cerveau.",
    sources: ['spf-pnns-guide', 'hcsp-2020']
  },
  {
    id: 'no-salt',
    body: 'Pas de sel ajouté avant 1 an : les reins de bébé éliminent mal le sel.',
    sources: ['spf-pnns-guide']
  },
  {
    id: 'no-sugar',
    body: 'Reportez le plus longtemps possible les produits sucrés. Bébé apprécie naturellement les vrais goûts.',
    sources: ['spf-pnns-guide']
  },
  {
    id: 'iron-6m',
    body: "Dès 6 mois, viande / poisson / œuf / légumineuses sont essentiels pour l'apport en fer.",
    stages: ['6-9'],
    sources: ['hcsp-2020']
  },
  {
    id: 'milk-stays',
    body: "Le lait (maternel ou infantile) reste l'aliment principal jusqu'à 1 an. Comptez ~500 mL/jour à 6 mois.",
    stages: ['4-6', '6-9', '9-12'],
    sources: ['hcsp-2020']
  },
  {
    id: 'allergens-window',
    body: 'La fenêtre 4–11 mois est clé pour introduire les allergènes (œuf, arachide, lait, gluten…). Ne pas la rater.',
    stages: ['4-6', '6-9'],
    sources: ['leap-2015', 'eat-2016', 'espghan-2017']
  },
  {
    id: 'peanut-form',
    body: 'Beurre de cacahuète lisse dilué dans une purée ou un yaourt : jamais de cacahuète entière avant 5 ans.',
    allergens: ['arachide'],
    sources: ['leap-2015']
  },
  {
    id: 'egg-fully-cooked',
    body: "Toujours œuf bien cuit (jaune et blanc fermes). Pas d'œuf coulant ni de mayo maison avant 3 ans.",
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
    body: 'Une fois un allergène introduit, ré-exposez-le 1 à 2 fois par semaine pour entretenir la tolérance.',
    sources: ['eat-2016', 'espghan-2017']
  },
  {
    id: 'one-novelty',
    body: 'Une nouveauté à la fois, en début de repas, pour pouvoir attribuer une éventuelle réaction.',
    stages: ['4-6'],
    sources: ['spf-pnns-guide']
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
    body: 'Variez les groupes : un légume et un féculent à chaque repas, viande/poisson/œuf/légumineuses en alternance.',
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
    body: "L'étude EAT a montré qu'introduire 6 allergènes dès 3–4 mois divise par 3 le risque d'allergie alimentaire.",
    stages: ['4-6'],
    sources: ['eat-2016']
  },
  {
    id: 'leap-study',
    body: "L'étude LEAP : chez les bébés à risque, l'introduction précoce de l'arachide a réduit l'allergie de 86 %.",
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
    body: 'Limitez les gros poissons prédateurs (espadon, requin, marlin) : méthylmercure. Privilégiez sardine, maquereau, saumon.',
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

// Re-export for components that want the full list of source IDs.
export { ALL_SOURCE_IDS };
