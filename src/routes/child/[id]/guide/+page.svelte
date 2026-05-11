<script lang="ts">
  import DiscoverBento from '$lib/components/bento/DiscoverBento.svelte';
  import Card from '$components/ui/Card.svelte';
  import Button from '$components/ui/Button.svelte';
  import StageBadge from '$lib/components/StageBadge.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import GuideStaticSections, {
    STATIC_NAV_SECTIONS
  } from '$lib/components/GuideStaticSections.svelte';
  import { getStageForAgeMonths } from '$lib/content/guidance';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { BookOpen, Compass, AlertTriangle } from 'lucide-svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const currentStage = $derived(getStageForAgeMonths(data.ageMonths));
  const childId = $derived($page.params.id);

  const navSections = [
    { id: 'etape', label: 'Étape actuelle' },
    ...STATIC_NAV_SECTIONS
  ] as const;
</script>

{#if data.bento}
  <DiscoverBento
    stages={data.stages}
    activeStageId={data.currentStageId}
    suggestions={data.suggestions}
    todayTip={data.todayTip}
    tipDismissed={data.tipDismissed}
    onPickSuggestion={(food) => goto(`/child/${childId}?suggested=${food.id}`)}
    onDismissTip={() => {}}
  />
{:else}
<div class="container max-w-4xl space-y-8 py-6 md:py-8">
  <header class="space-y-2">
    <a
      href={localizedHref(`/child/${data.child.id}`)}
      class="text-sm text-muted-foreground hover:underline"
    >
      ← Tableau
    </a>
    <div class="mt-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary/80">
      <BookOpen size={14} aria-hidden="true" />
      Guide de la diversification
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

  <!-- In-page nav -->
  <nav aria-label="Sommaire du guide" class="rounded-lg border bg-surface p-3">
    <ul class="flex flex-wrap gap-2 text-xs">
      {#each navSections as s (s.id)}
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

  {#if $page.url.pathname.startsWith('/en')}
    <aside class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
      {m.commonFrOnlyBannerGuide()}
    </aside>
  {/if}

  <section lang="fr" class="space-y-8">
    <!-- 1. Current stage (child-specific) -->
    <section id="etape" class="scroll-mt-6 space-y-3">
    <div class="flex items-center gap-2">
      <Compass size={18} class="text-primary" aria-hidden="true" />
      <h2 class="text-xl font-semibold">Où en est bébé</h2>
    </div>
    <Card class="p-5 md:p-6">
      <div class="flex flex-wrap items-center gap-3">
        <StageBadge stage={currentStage} />
        <span class="text-xs text-muted-foreground">Bébé a {data.ageMonths} mois</span>
      </div>
      <h3 class="mt-3 text-lg font-semibold leading-tight">{currentStage.title}</h3>
      <p class="mt-1 text-sm text-foreground/90">{currentStage.oneLiner}</p>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Principes
          </h4>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
            {#each currentStage.principles as p, i (i)}
              <li>{p}</li>
            {/each}
          </ul>
        </div>
        <div>
          <h4 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Aliments à proposer
          </h4>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
            {#each currentStage.focus as p, i (i)}
              <li>{p}</li>
            {/each}
          </ul>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-md border bg-muted/40 p-3 text-sm">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Texture
          </div>
          <p class="mt-1">{currentStage.textures}</p>
        </div>
        <div class="rounded-md border bg-muted/40 p-3 text-sm">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Lait
          </div>
          <p class="mt-1">{currentStage.milkTarget}</p>
        </div>
      </div>

      {#if currentStage.redFlags.length > 0}
        <div class="mt-4 rounded-md border border-reaction-inconfort/30 bg-reaction-inconfort/5 p-3 text-sm">
          <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-reaction-inconfort">
            <AlertTriangle size={12} aria-hidden="true" />
            À surveiller
          </div>
          <ul class="mt-1 list-disc space-y-1 pl-5">
            {#each currentStage.redFlags as f, i (i)}
              <li>{f}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="mt-4">
        <SourceCitation ids={[...currentStage.sources]} inline />
      </div>
    </Card>
  </section>

    <GuideStaticSections currentStageId={currentStage.id} />
  </section>

  <div class="pt-2 text-center">
    <Button href={localizedHref(`/child/${data.child.id}`)} variant="ghost">← Retour au tableau</Button>
  </div>
</div>
{/if}
