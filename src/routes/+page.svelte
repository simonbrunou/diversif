<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Button from '$components/ui/Button.svelte';
  import LandingHero from '$lib/components/landing/LandingHero.svelte';
  import LandingFeatures from '$lib/components/landing/LandingFeatures.svelte';
  import LandingTrust from '$lib/components/landing/LandingTrust.svelte';
  import LandingClosingCta from '$lib/components/landing/LandingClosingCta.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import { SITE, faqPageJsonLd, webApplicationJsonLd } from '$lib/seo';
  import { page } from '$app/stores';
  import { formatAge } from '$lib/utils/age';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const siteUrl = $derived($page.data.siteUrl ?? SITE.defaultOrigin);

  const landingFaq = [
    {
      q: 'Quand commencer la diversification alimentaire de mon bébé ?',
      a: "Les recommandations françaises (HCSP 2020, Santé publique France) et européennes (ESPGHAN 2017) convergent : la diversification se commence entre 4 et 6 mois révolus, jamais avant 4 mois (17 semaines), idéalement avant 6 mois pour profiter de la fenêtre d'introduction des allergènes."
    },
    {
      q: 'Quels sont les 12 allergènes prioritaires à introduire ?',
      a: "Œuf, arachide, fruits à coque, lait de vache, sésame, soja, gluten (blé), poisson, crustacés, mollusques, céleri et moutarde. L'introduction précoce, dès 4–6 mois, réduit le risque d'allergie d'après les études LEAP (2015) et EAT (2016)."
    },
    {
      q: 'Faut-il choisir entre purées et DME (diversification menée par l\'enfant) ?',
      a: "Non. La Société Française de Pédiatrie reconnaît la DME, les purées classiques et l'approche mixte comme valides. L'important est d'adapter la texture à l'âge, surveiller les signes d'étouffement et proposer une alimentation variée."
    },
    {
      q: 'Quels aliments éviter avant 1 an et avant 3 ans ?',
      a: "Avant 1 an : miel (botulisme), lait de vache nature en boisson, sel ajouté, sucre ajouté, jus de fruits. Avant 3 ans : aliments crus à risque (œufs crus, viandes/poissons crus), aliments durs et ronds (cacahuètes, raisins entiers), boissons sucrées et édulcorées."
    },
    {
      q: 'Diversif est-il gratuit et sans publicité ?',
      a: 'Oui. Diversif est open source, self-hosted, gratuit et sans publicité. Vos données restent sur votre propre serveur ou hébergeur.'
    }
  ];
</script>

{#if data.kind === 'landing'}
  <Seo
    title="Diversif — Diversification alimentaire bébé : guide, suivi, partage parents"
    description={SITE.description}
    path="/"
  />
  <JsonLd data={webApplicationJsonLd(siteUrl)} />
  <JsonLd data={faqPageJsonLd(landingFaq)} />
{:else}
  <Seo title={`Choisir un enfant · ${SITE.name}`} path="/" noindex />
{/if}

{#if data.kind === 'landing'}
  <LandingHero />
  <LandingFeatures />

  <section class="container max-w-4xl pb-4 text-center">
    <p class="text-sm text-muted-foreground">Le guide complet, accessible sans compte.</p>
    <ul class="mt-3 flex flex-wrap justify-center gap-2">
      {#each [{ href: '/guide#regles', label: "10 règles d'or" }, { href: '/guide#etapes', label: '4 étapes' }, { href: '/guide#allergenes', label: '12 allergènes' }] as chip (chip.href)}
        <li>
          <a
            href={localizedHref(chip.href)}
            class="inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {chip.label}
          </a>
        </li>
      {/each}
    </ul>
  </section>

  <LandingTrust />
  <LandingClosingCta />
{:else}
  <div class="container max-w-2xl py-10">
    <h1 class="text-2xl font-semibold">Choisir un enfant</h1>
    <p class="mt-2 text-sm text-muted-foreground">Sélectionnez l'enfant à suivre.</p>

    <div class="mt-6 grid gap-3">
      {#each data.children as child (child.id)}
        <a href={localizedHref(`/child/${child.id}`)} class="block">
          <Card class="p-4 transition-colors hover:bg-accent">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">{child.name}</div>
                <div class="text-sm text-muted-foreground">{formatAge(child.birthDate)}</div>
              </div>
              <span class="text-xs text-muted-foreground">
                {child.role === 'owner' ? 'Créateur' : 'Membre'}
              </span>
            </div>
          </Card>
        </a>
      {/each}
    </div>

    <div class="mt-6">
      <Button href={localizedHref('/child/new')} variant="outline">+ Ajouter un enfant</Button>
    </div>
  </div>
{/if}
