<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import { breadcrumbJsonLd, SITE } from '$lib/seo';
  import { languageTag } from '$lib/paraglide/runtime';
  import * as m from '$lib/paraglide/messages';
  import { page } from '$app/stores';
  import { SOURCES, ALL_SOURCE_IDS } from '$lib/content/sources';
  import { Library, ExternalLink } from 'lucide-svelte';

  const siteUrl = $derived($page.data.siteUrl ?? SITE.defaultOrigin);

  const sourcesItemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Sources et références scientifiques sur la diversification alimentaire',
    itemListElement: ALL_SOURCE_IDS.map((id, i) => {
      const s = SOURCES[id];
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'CreativeWork',
          name: s.label,
          author: { '@type': 'Organization', name: s.org },
          datePublished: String(s.year),
          url: s.url
        }
      };
    })
  };
</script>

<Seo
  title="Sources et références — diversification alimentaire bébé · Diversif"
  description="Les 10 sources qui font autorité derrière Diversif : HCSP, Santé publique France, ANSES, ESPGHAN, OMS, Société Française de Pédiatrie, études LEAP et EAT."
  path="/sources"
  ogType="article"
/>
<JsonLd data={sourcesItemList} />
<JsonLd
  data={breadcrumbJsonLd(siteUrl, [
    { name: 'Accueil', path: '/' },
    { name: 'Sources', path: '/sources' }
  ])}
/>

<div class="container max-w-3xl space-y-8 py-6 md:py-8">
  {#if languageTag() === 'en'}
    <aside class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
      {m.commonFrOnlyBannerSources()}
    </aside>
  {/if}

  <section lang="fr" class="space-y-8">
    <header class="space-y-2">
      <div class="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary/80">
        <Library size={14} aria-hidden="true" />
        Sources
      </div>
      <h1 class="text-2xl font-semibold leading-tight md:text-3xl">Sources et références</h1>
      <p class="max-w-2xl text-sm text-muted-foreground">
        Toutes les recommandations affichées dans Diversif s'appuient sur des sources publiques et
        vérifiables — institutionnelles (HCSP, Santé publique France, ANSES, OMS), sociétés savantes
        (ESPGHAN, Société Française de Pédiatrie) et études cliniques de référence (LEAP, EAT). En
        cas de doute, consultez votre pédiatre.
      </p>
    </header>

    <ul class="grid gap-3">
      {#each ALL_SOURCE_IDS as id (id)}
        {@const s = SOURCES[id]}
        <li>
          <Card class="p-4">
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-start gap-1.5 text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            >
              <span>{s.label}</span>
              <ExternalLink size={12} class="mt-1 shrink-0" aria-hidden="true" />
            </a>
            <div class="mt-1 text-xs text-muted-foreground">{s.org} · {s.year}</div>
          </Card>
        </li>
      {/each}
    </ul>

    <Card class="p-5 text-center md:p-6">
      <h2 class="text-lg font-semibold">Prêt·e à diversifier sereinement ?</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Diversif n'est pas un avis médical individuel. En cas de doute sur l'introduction d'un
        aliment, demandez conseil à votre pédiatre ou à un allergologue.
      </p>
      <div class="mt-4 flex flex-wrap justify-center gap-3">
        <Button href="/signup">Créer un compte</Button>
        <Button href="/guide" variant="outline">Lire le guide</Button>
      </div>
    </Card>
  </section>
</div>
