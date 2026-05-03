<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import { SOURCES, ALL_SOURCE_IDS } from '$lib/content/sources';
  import { Library, ExternalLink } from 'lucide-svelte';
</script>

<svelte:head>
  <title>Sources et références · Diversif</title>
  <meta
    name="description"
    content="Les 10 sources qui font autorité derrière Diversif : HCSP, Santé publique France, ANSES, ESPGHAN, OMS, SFP, études LEAP et EAT."
  />
  <link rel="canonical" href="/sources" />
  <meta property="og:title" content="Sources et références · Diversif" />
  <meta
    property="og:description"
    content="Les 10 sources qui font autorité derrière Diversif : HCSP, Santé publique France, ANSES, ESPGHAN, OMS, SFP, études LEAP et EAT."
  />
  <meta property="og:type" content="website" />
</svelte:head>

<div class="container max-w-3xl space-y-8 py-6 md:py-8">
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
</div>
