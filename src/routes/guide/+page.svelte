<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import GuideStaticSections, {
    STATIC_NAV_SECTIONS
  } from '$lib/components/GuideStaticSections.svelte';
  import { BookOpen } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Guide de la diversification — 4 mois à 3 ans · Diversif</title>
  <meta
    name="description"
    content="Guide complet et sourcé : 10 règles d'or, 4 étapes, 12 allergènes prioritaires, textures, aliments à éviter, réactions allergiques. Sources HCSP, ESPGHAN, LEAP, EAT."
  />
  <link rel="canonical" href="/guide" />
  <meta property="og:title" content="Guide de la diversification — 4 mois à 3 ans · Diversif" />
  <meta
    property="og:description"
    content="Guide complet et sourcé : 10 règles d'or, 4 étapes, 12 allergènes prioritaires, textures, aliments à éviter, réactions allergiques."
  />
  <meta property="og:type" content="website" />
</svelte:head>

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
