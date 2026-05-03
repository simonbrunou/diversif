<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Button from '$components/ui/Button.svelte';
  import LandingHero from '$lib/components/landing/LandingHero.svelte';
  import LandingFeatures from '$lib/components/landing/LandingFeatures.svelte';
  import LandingTrust from '$lib/components/landing/LandingTrust.svelte';
  import LandingClosingCta from '$lib/components/landing/LandingClosingCta.svelte';
  import { formatAge } from '$lib/utils/age';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  {#if data.kind === 'landing'}
    <title>Diversif — Diversification alimentaire bébé : guide, suivi, partage parents</title>
    <meta
      name="description"
      content="Suivez la diversification alimentaire de votre bébé de 4 mois à 3 ans. Étapes, allergènes, textures, à éviter — adossé HCSP, Santé publique France, ESPGHAN. Self-hosted, sans publicité."
    />
    <link rel="canonical" href="/" />
    <meta
      property="og:title"
      content="Diversif — Diversification alimentaire bébé : guide, suivi, partage parents"
    />
    <meta
      property="og:description"
      content="Suivez la diversification alimentaire de votre bébé de 4 mois à 3 ans. Étapes, allergènes, textures, à éviter — adossé HCSP, Santé publique France, ESPGHAN."
    />
    <meta property="og:type" content="website" />
  {/if}
</svelte:head>

{#if data.kind === 'landing'}
  <LandingHero />
  <LandingFeatures />

  <section class="container max-w-4xl pb-4 text-center">
    <p class="text-sm text-muted-foreground">Le guide complet, accessible sans compte.</p>
    <ul class="mt-3 flex flex-wrap justify-center gap-2">
      {#each [{ href: '/guide#regles', label: "10 règles d'or" }, { href: '/guide#etapes', label: '4 étapes' }, { href: '/guide#allergenes', label: '12 allergènes' }] as chip (chip.href)}
        <li>
          <a
            href={chip.href}
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
        <a href={`/child/${child.id}`} class="block">
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
      <Button href="/child/new" variant="outline">+ Ajouter un enfant</Button>
    </div>
  </div>
{/if}
