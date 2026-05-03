<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import GuideStaticSections, {
    STATIC_NAV_SECTIONS
  } from '$lib/components/GuideStaticSections.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import { articleJsonLd, breadcrumbJsonLd, faqPageJsonLd, SITE } from '$lib/seo';
  import { page } from '$app/stores';
  import { BookOpen } from 'lucide-svelte';

  const siteUrl = $derived($page.data.siteUrl ?? SITE.defaultOrigin);

  const guideFaq = [
    {
      q: "Comment démarrer la diversification à 4 mois ?",
      a: "Proposez 1 cuillère le midi, en complément du lait, d'un aliment à la fois pendant 2–3 jours pour repérer une éventuelle réaction. Commencez par des légumes ou fruits cuits écrasés très fins. Le lait reste l'apport principal."
    },
    {
      q: "À quel âge introduire les allergènes ?",
      a: "Entre 4 et 11 mois, sans retarder. La fenêtre d'opportunité immunologique se referme après 12 mois. Étude LEAP : -86 % de risque d'allergie à l'arachide chez les bébés à risque introduits tôt."
    },
    {
      q: "Quelles textures à quel âge ?",
      a: "4–6 mois : purées très lisses. 6–8 mois : purées plus épaisses, écrasées à la fourchette. 8–10 mois : petits morceaux fondants. 10–12 mois : morceaux tendres, finger food. Après 12 mois : alimentation familiale adaptée."
    },
    {
      q: "Que faire en cas de réaction allergique ?",
      a: "Réaction légère (rougeurs autour de la bouche, vomissement isolé) : arrêter l'aliment, surveiller, consulter le pédiatre. Réaction sévère (œdème, gêne respiratoire, urticaire généralisée, perte de tonus) : appeler le 15 sans délai."
    },
    {
      q: "Quels aliments sont interdits avant 1 an ?",
      a: "Miel (botulisme infantile), lait de vache en boisson principale, sel ajouté, sucre ajouté, édulcorants, jus de fruits, charcuterie crue, fromages au lait cru, œufs crus ou peu cuits."
    },
    {
      q: "DME ou purées classiques : que choisir ?",
      a: "Les deux approches sont reconnues par la SFP (2022). La DME demande une vigilance accrue sur la sécurité (étouffement) ; les purées contrôlent mieux les quantités. L'approche mixte combine les avantages des deux."
    }
  ];
</script>

<Seo
  title="Guide de la diversification alimentaire — bébé de 4 mois à 3 ans · Diversif"
  description="Guide complet et sourcé : 10 règles d'or, 4 étapes par âge, 12 allergènes prioritaires, textures, aliments à éviter, réactions allergiques. Sources HCSP, Santé publique France, ESPGHAN, OMS, études LEAP et EAT."
  path="/guide"
  ogType="article"
/>
<JsonLd
  data={articleJsonLd(siteUrl, {
    title: 'Guide de la diversification alimentaire — bébé de 4 mois à 3 ans',
    description:
      "Guide complet et sourcé : 10 règles d'or, 4 étapes par âge, 12 allergènes prioritaires, textures, aliments à éviter, réactions allergiques.",
    path: '/guide',
    datePublished: '2025-01-01',
    dateModified: new Date().toISOString().slice(0, 10)
  })}
/>
<JsonLd data={faqPageJsonLd(guideFaq)} />
<JsonLd
  data={breadcrumbJsonLd(siteUrl, [
    { name: 'Accueil', path: '/' },
    { name: 'Guide', path: '/guide' }
  ])}
/>

<div class="container max-w-4xl space-y-8 py-6 md:py-8">
  <header class="space-y-2">
    <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary/80">
      <BookOpen size={14} aria-hidden="true" />
      Guide
    </div>
    <h1 class="text-2xl font-semibold leading-tight md:text-3xl">
      Diversifier en confiance, sources à l'appui
    </h1>
    <p class="max-w-2xl text-sm text-muted-foreground">
      L'essentiel sur la diversification alimentaire de 4 mois à 3 ans : démarrer, allergènes,
      textures, aliments à éviter, conduite à tenir en cas de réaction. Toutes les recommandations
      renvoient à leurs sources officielles.
    </p>
  </header>

  <nav aria-label="Sommaire du guide" class="rounded-lg border bg-surface p-3">
    <ul class="flex flex-wrap gap-2 text-xs">
      {#each STATIC_NAV_SECTIONS as s (s.id)}
        <li>
          <a
            href={`#${s.id}`}
            class="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {s.label}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <GuideStaticSections currentStageId={null} />

  <Card class="p-5 text-center md:p-6">
    <h2 class="text-lg font-semibold">Suivre tout ça en pratique ?</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      Diversif vous aide à logguer chaque aliment, suivre les 12 allergènes et partager le tableau
      avec l'autre parent.
    </p>
    <div class="mt-4 flex flex-wrap justify-center gap-3">
      <Button href="/signup">Créer un compte gratuit</Button>
      <Button href="/sources" variant="outline">Voir les sources</Button>
    </div>
  </Card>
</div>
