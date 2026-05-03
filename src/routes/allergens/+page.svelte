<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import AllergenInfoDialog from '$lib/components/AllergenInfoDialog.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import { ALLERGENS, type AllergenId } from '$lib/utils/allergens';
  import { ALLERGEN_GUIDANCE } from '$lib/content/guidance';
  import { ShieldCheck } from 'lucide-svelte';

  let openAllergenId = $state<AllergenId | null>(null);
</script>

<svelte:head>
  <title>Les 12 allergènes majeurs · Diversif</title>
  <meta
    name="description"
    content="Les 12 allergènes prioritaires à introduire entre 4 et 11 mois : œuf, arachide, fruits à coque, lait, sésame, soja, gluten, poisson, crustacés, mollusques, céleri, moutarde. Comment, quand, signes à surveiller."
  />
  <link rel="canonical" href="/allergens" />
  <meta property="og:title" content="Les 12 allergènes majeurs · Diversif" />
  <meta
    property="og:description"
    content="Les 12 allergènes prioritaires à introduire entre 4 et 11 mois — comment, quand, signes à surveiller. Sources LEAP, EAT, ESPGHAN, HCSP."
  />
  <meta property="og:type" content="website" />
</svelte:head>

<div class="container max-w-4xl space-y-8 py-6 md:py-8">
  <header class="space-y-2">
    <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary/80">
      <ShieldCheck size={14} aria-hidden="true" />
      Allergènes
    </div>
    <h1 class="text-2xl font-semibold leading-tight md:text-3xl">Les 12 allergènes majeurs</h1>
    <p class="max-w-2xl text-sm text-muted-foreground">
      Les recommandations actuelles sont claires : ne plus retarder l'introduction des allergènes.
      La fenêtre 4–11 mois est clé pour réduire le risque d'allergie.
    </p>
  </header>

  <Card class="p-4 md:p-5">
    <p class="text-sm text-foreground/90">
      L'étude <strong>LEAP</strong> a montré que l'introduction précoce de l'arachide réduisait de
      86 % le risque d'allergie chez les nourrissons à risque. L'étude <strong>EAT</strong>,
      portant sur 6 allergènes (arachide, œuf, lait, sésame, poisson, blé) introduits dès 3–4
      mois, a divisé par 3 la prévalence d'allergies alimentaires.
    </p>
    <div class="mt-3">
      <SourceCitation ids={['leap-2015', 'eat-2016', 'espghan-2017', 'hcsp-2020']} inline />
    </div>
  </Card>

  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
    {#each ALLERGENS as a (a.id)}
      {@const g = ALLERGEN_GUIDANCE[a.id]}
      <button
        type="button"
        onclick={() => (openAllergenId = a.id)}
        class="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium">{a.label}</span>
          <Badge variant="default" class="shrink-0 text-[10px]">
            Dès {g.recommendedAgeMonths} mois
          </Badge>
        </div>
        <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.why}</p>
      </button>
    {/each}
  </div>

  <Card class="p-5 text-center md:p-6">
    <h2 class="text-lg font-semibold">Suivre l'introduction des allergènes</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      Diversif suit pour vous l'introduction des 12 allergènes prioritaires et vous rappelle ceux
      qui restent à proposer dans la bonne fenêtre.
    </p>
    <div class="mt-4 flex flex-wrap justify-center gap-3">
      <Button href="/signup">Créer un compte pour les suivre</Button>
      <Button href="/guide" variant="outline">Lire le guide complet</Button>
    </div>
  </Card>
</div>

<AllergenInfoDialog bind:allergenId={openAllergenId} />
