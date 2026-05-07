<script lang="ts">
  import Seo from '$lib/components/Seo.svelte';
  import { languageTag } from '$lib/paraglide/runtime';
  import * as m from '$lib/paraglide/messages';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  const legal = $derived(data.legal);
</script>

<Seo
  title="Mentions légales · Diversif"
  description="Mentions légales du site Diversif : éditeur, hébergeur, contact."
  path="/mentions-legales"
  noindex
/>

<div class="container max-w-3xl space-y-6 py-8 md:py-12">
  {#if languageTag() === 'en'}
    <aside class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
      {m.commonFrOnlyBannerLegal()}
    </aside>
  {/if}

  <section lang="fr" class="space-y-6">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight md:text-3xl">Mentions légales</h1>
      <p class="text-sm text-muted-foreground">Dernière mise à jour : 4 mai 2026.</p>
    </header>

  <section class="space-y-2">
    <h2 class="text-lg font-semibold">Éditeur du site</h2>
    <p class="text-sm">
      <span class="font-medium">{legal.controllerName}</span><br />
      Adresse : {legal.controllerAddress}<br />
      Contact : <a class="underline" href={`mailto:${legal.controllerEmail}`}>{legal.controllerEmail}</a>
    </p>
    <p class="text-sm">Directeur de la publication : {legal.publicationDirector}</p>
  </section>

  <section class="space-y-2">
    <h2 class="text-lg font-semibold">Hébergeur</h2>
    <p class="text-sm">
      <span class="font-medium">{legal.hostProvider}</span><br />
      {legal.hostProviderAddress}
    </p>
  </section>

  <section class="space-y-2">
    <h2 class="text-lg font-semibold">Propriété intellectuelle</h2>
    <p class="text-sm">
      Le code source de Diversif est publié sous licence libre sur
      <a class="underline" href="https://github.com/simonbrunou/diversif" target="_blank" rel="noopener noreferrer">GitHub</a>.
      Les contenus rédactionnels (guides, fiches allergènes, sources) sont mis à disposition pour un
      usage personnel et familial. Toute reproduction commerciale est interdite sans accord préalable.
    </p>
  </section>

  <section class="space-y-2">
    <h2 class="text-lg font-semibold">Avertissement médical</h2>
    <p class="text-sm">
      Diversif fournit des informations générales sur la diversification alimentaire à partir de
      sources reconnues (HCSP, Santé publique France, ANSES, ESPGHAN, OMS). Ces informations ne
      remplacent pas un avis médical individuel. En cas de doute ou de réaction, consultez votre
      pédiatre ou un allergologue.
    </p>
  </section>

    <section class="space-y-2">
      <h2 class="text-lg font-semibold">Données personnelles</h2>
      <p class="text-sm">
        Le traitement des données personnelles est décrit sur la page
        <a class="underline" href="/politique-confidentialite">Politique de confidentialité</a>.
      </p>
    </section>
  </section>
</div>
