<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import * as m from '$lib/paraglide/messages';
  import { page } from '$app/stores';
  import { localizedHref } from '$lib/utils/localized-href';
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

<div class="mx-auto max-w-3xl px-6 py-6 text-ink sm:px-10">
  <BackHeader fallback="/" />
  {#if $page.url.pathname.startsWith('/en')}
    <aside class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
      {m.commonFrOnlyBannerLegal()}
    </aside>
  {/if}

  <section lang="fr" class="mt-8 space-y-3">
    <header class="space-y-2">
      <h1 class="font-display text-3xl italic">Mentions légales</h1>
      <p class="text-sm leading-relaxed">Dernière mise à jour : 4 mai 2026.</p>
    </header>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">Éditeur du site</h2>
    <p class="text-sm leading-relaxed">
      <span class="font-medium">{legal.controllerName}</span><br />
      Adresse : {legal.controllerAddress}<br />
      Contact : <a class="text-primary-strong underline" href={`mailto:${legal.controllerEmail}`}>{legal.controllerEmail}</a>
    </p>
    <p class="text-sm leading-relaxed">Directeur de la publication : {legal.publicationDirector}</p>
  </section>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">Hébergeur</h2>
    <p class="text-sm leading-relaxed">
      <span class="font-medium">{legal.hostProvider}</span><br />
      {legal.hostProviderAddress}
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">Propriété intellectuelle</h2>
    <p class="text-sm leading-relaxed">
      Le code source de Diversif est publié sous licence libre sur
      <a class="text-primary-strong underline" href="https://github.com/simonbrunou/diversif" target="_blank" rel="noopener noreferrer">GitHub</a>.
      Les contenus rédactionnels (guides, fiches allergènes, sources) sont mis à disposition pour un
      usage personnel et familial. Toute reproduction commerciale est interdite sans accord préalable.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">Avertissement médical</h2>
    <p class="text-sm leading-relaxed">
      Diversif fournit des informations générales sur la diversification alimentaire à partir de
      sources reconnues (HCSP, Santé publique France, ANSES, ESPGHAN, OMS). Ces informations ne
      remplacent pas un avis médical individuel. En cas de doute ou de réaction, consultez votre
      pédiatre ou un allergologue.
    </p>
  </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">Données personnelles</h2>
      <p class="text-sm leading-relaxed">
        Le traitement des données personnelles est décrit sur la page
        <a class="text-primary-strong underline" href={localizedHref('/politique-confidentialite')}>Politique de confidentialité</a>.
      </p>
    </section>
  </section>
</div>
