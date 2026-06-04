<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Callout from '$lib/components/ui/Callout.svelte';
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import AllergenInfoDialog from '$lib/components/AllergenInfoDialog.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import { articleJsonLd, breadcrumbJsonLd, SITE } from '$lib/seo';
  import { page } from '$app/state';
  import { ALLERGENS, type AllergenId } from '$lib/utils/allergens';
  import { ALLERGEN_GUIDANCE } from '$lib/content/guidance';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import { ShieldCheck } from 'lucide-svelte';

  let openAllergenId = $state<AllergenId | null>(null);

  const siteUrl = SITE.defaultOrigin;

  const allergensItemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Les 12 allergènes prioritaires en diversification alimentaire',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: ALLERGENS.length,
    itemListElement: ALLERGENS.map((a, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: a.label,
      description: ALLERGEN_GUIDANCE[a.id].why
    }))
  };
</script>

<Seo
  title="Les 12 allergènes prioritaires en diversification alimentaire bébé · Diversif"
  description="Œuf, arachide, fruits à coque, lait, sésame, soja, gluten, poisson, crustacés, mollusques, céleri, moutarde : quand introduire, comment, signes d'allergie à surveiller. Sources LEAP, EAT, ESPGHAN, HCSP."
  path="/allergens"
  ogType="article"
/>
<JsonLd
  data={articleJsonLd(siteUrl, {
    title: 'Les 12 allergènes prioritaires en diversification alimentaire bébé',
    description:
      "Quand et comment introduire chacun des 12 allergènes alimentaires majeurs entre 4 et 11 mois, signes d'allergie à surveiller, conduite à tenir.",
    path: '/allergens',
    datePublished: '2025-01-01',
    dateModified: '2026-05-03'
  })}
/>
<JsonLd data={allergensItemList} />
<JsonLd
  data={breadcrumbJsonLd(siteUrl, [
    { name: 'Accueil', path: '/' },
    { name: 'Allergènes', path: '/allergens' }
  ])}
/>

<div class="mx-auto w-full px-4 max-w-4xl space-y-8 py-6 md:py-8">
  {#if page.url.pathname.startsWith('/en')}
    <Callout variant="warning">
      {m.commonFrOnlyBannerGuide()}
    </Callout>
  {/if}

  <section lang="fr" class="space-y-8">
  <header class="space-y-2">
    <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary-strong">
      <ShieldCheck size={14} aria-hidden="true" />
      Allergènes
    </div>
    <h1 class="text-2xl font-semibold leading-tight md:text-3xl">Les 12 allergènes majeurs</h1>
    <p class="max-w-2xl text-sm text-muted-foreground">
      Les recommandations actuelles sont claires : ne plus retarder l'introduction des allergènes
      prioritaires (œuf, arachide, lait, gluten, poisson, fruits à coque, sésame). La fenêtre 4–11
      mois est clé pour réduire le risque d'allergie.
    </p>
  </header>

  <Card class="p-4 md:p-5">
    <p class="text-sm text-foreground/90">
      L'étude <strong>LEAP</strong> a montré que l'introduction précoce de l'arachide réduisait de
      86 % le risque d'allergie chez les nourrissons à risque. L'étude <strong>EAT</strong>,
      portant sur 6 allergènes (arachide, œuf, lait, sésame, poisson, blé) introduits dès 3–4
      mois, a divisé par 3 la prévalence d'allergies alimentaires.
    </p>
    <p class="mt-2 text-sm text-foreground/90">
      <strong>Cas particuliers.</strong> Le <strong>soja</strong> est tracé ici pour le suivi mais
      HCSP 2020 et ANSES déconseillent les produits à base de soja avant 3 ans (phyto-œstrogènes).
      Les <strong>crustacés, mollusques, céleri et moutarde</strong> figurent dans la liste pour
      la complétude (règlement UE 1169/2011), sans recommandation d'introduction précoce
      spécifique.
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

  <Card padding="lg" class="text-center mt-8">
    <h2 class="text-base font-semibold">Suivre l'introduction des allergènes</h2>
    <p class="mt-1 text-sm text-ink-soft">
      Diversif suit l'introduction des 12 allergènes du carnet et vous rappelle les allergènes
      prioritaires (œuf, arachide, lait, gluten, poisson, fruits à coque, sésame) qui restent à
      proposer dans la fenêtre 4–11 mois.
    </p>
    <div class="mt-4 flex flex-wrap justify-center gap-3">
      <Button href={localizedHref('/signup')}>Créer un compte pour les suivre</Button>
      <Button href={localizedHref('/guide')} variant="outline">Lire le guide complet</Button>
    </div>
  </Card>
  </section>
</div>

<AllergenInfoDialog bind:allergenId={openAllergenId} />
