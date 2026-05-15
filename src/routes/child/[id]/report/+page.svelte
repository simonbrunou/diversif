<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import CategoryTag from '$lib/components/CategoryTag.svelte';
  import { getCategoryLabel } from '$lib/utils/categories';
  import { getReactionLabel } from '$lib/utils/reactions';
  import { formatAge } from '$lib/utils/age';
  import { localizedHref } from '$lib/utils/localized-href';
  import { getTextureLabel } from '$lib/utils/texture-labels';
  import * as m from '$lib/paraglide/messages';
  import { Printer, CheckCircle2, AlertCircle, OctagonAlert, CircleDashed } from 'lucide-svelte';
  import dayjs from 'dayjs';
  import 'dayjs/locale/fr';
  import { languageTag } from '$lib/paraglide/runtime';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function printPage() {
    if (typeof window !== 'undefined') window.print();
  }

  function fmtDay(ts: number): string {
    return dayjs(ts).locale(languageTag()).format('D MMM YYYY');
  }

  function reactionIcon(r: 'ras' | 'inconfort' | 'reaction') {
    return r === 'ras' ? CheckCircle2 : r === 'inconfort' ? AlertCircle : OctagonAlert;
  }

  function reactionClass(r: 'ras' | 'inconfort' | 'reaction'): string {
    return r === 'ras'
      ? 'text-reaction-ras'
      : r === 'inconfort'
        ? 'text-reaction-inconfort'
        : 'text-reaction-reaction';
  }
</script>

<svelte:head>
  <title>Récap pédiatrique : {data.child.name} · Diversif</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div
  class="container max-w-4xl space-y-6 py-6 print:max-w-none print:py-0 print:text-[12px] print:text-black"
>
  <!-- Toolbar (screen only) -->
  <div class="flex items-center justify-between print:hidden">
    <a href={localizedHref(`/child/${data.child.id}`)} class="text-sm text-muted-foreground hover:underline">
      ← Tableau
    </a>
    <Button variant="outline" onclick={printPage}>
      <Printer size={16} aria-hidden="true" />
      Imprimer / Enregistrer en PDF
    </Button>
  </div>

  <!-- Document header -->
  <header class="space-y-2 border-b pb-4">
    <div class="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
      <span>Récap pédiatrique · Diversif</span>
      <span>Édité le {fmtDay(data.generatedAt)}</span>
    </div>
    <h1 class="font-display text-3xl font-semibold leading-tight md:text-4xl">
      {data.child.name}
    </h1>
    <p class="text-sm text-muted-foreground">
      {formatAge(data.child.birthDate)} · {data.stage.title}
    </p>
  </header>

  <!-- Summary stats -->
  <section class="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
    <div class="rounded-md border p-3 print:border-black/20">
      <div class="text-[11px] uppercase tracking-wider text-muted-foreground">Aliments</div>
      <div class="mt-1 font-display text-xl font-semibold leading-none tabular-nums">
        {data.totals.foods}
      </div>
      <div class="mt-1 text-[11px] text-muted-foreground">distincts introduits</div>
    </div>
    <div class="rounded-md border p-3 print:border-black/20">
      <div class="text-[11px] uppercase tracking-wider text-muted-foreground">Repas</div>
      <div class="mt-1 font-display text-xl font-semibold leading-none tabular-nums">
        {data.totals.entries}
      </div>
      <div class="mt-1 text-[11px] text-muted-foreground">notés au total</div>
    </div>
    <div class="rounded-md border p-3 print:border-black/20">
      <div class="text-[11px] uppercase tracking-wider text-muted-foreground">Catégories</div>
      <div class="mt-1 font-display text-xl font-semibold leading-none tabular-nums">
        {data.totals.categoriesCovered}<span class="text-sm font-normal text-muted-foreground">
          / {data.totals.categoriesTotal}</span
        >
      </div>
      <div class="mt-1 text-[11px] text-muted-foreground">familles couvertes</div>
    </div>
    <div class="rounded-md border p-3 print:border-black/20">
      <div class="text-[11px] uppercase tracking-wider text-muted-foreground">Allergènes</div>
      <div class="mt-1 font-display text-xl font-semibold leading-none tabular-nums">
        {data.totals.allergensIntroduced}<span class="text-sm font-normal text-muted-foreground">
          / {data.totals.allergensTotal}</span
        >
      </div>
      <div class="mt-1 text-[11px] text-muted-foreground">prioritaires testés</div>
    </div>
  </section>

  <!-- Stage status -->
  <section class="space-y-2 rounded-lg border bg-card p-4">
    <h2 class="text-lg font-semibold">{m.reportStageHeading()}</h2>
    <p class="text-sm text-muted-foreground">{data.stage.title}</p>
    <p class="text-sm">{data.stage.oneLiner}</p>
    <p class="text-sm">
      <span class="text-muted-foreground">{m.reportStageExpectedTextures()} : </span>{data.stage.textures}
    </p>
    {#if data.mostAdvancedTexture}
      <p class="text-sm">
        <span class="text-muted-foreground">{m.reportStageMostAdvancedTexture()} : </span>
        {getTextureLabel(data.mostAdvancedTexture)}
      </p>
    {/if}
  </section>

  <!-- Allergens grid -->
  <section class="space-y-3 break-inside-avoid">
    <h2 class="font-display text-xl font-semibold">Allergènes prioritaires</h2>
    <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2 print:grid-cols-2">
      {#each data.allergens as a (a.id)}
        {@const Icon = a.status === 'untested' ? CircleDashed : reactionIcon(a.worst!)}
        <li
          class="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm print:border-black/20"
        >
          <div class="flex min-w-0 items-center gap-2">
            <Icon
              size={14}
              class={a.status === 'untested' ? 'text-muted-foreground/60' : reactionClass(a.worst!)}
              aria-hidden="true"
            />
            <span class="truncate font-medium">{a.label}</span>
          </div>
          {#if a.status === 'introduced'}
            <span class="shrink-0 text-xs text-muted-foreground">
              {a.exposures}× · dès {fmtDay(a.firstGivenAt!)}
            </span>
          {:else}
            <span class="shrink-0 text-xs text-muted-foreground">à tester</span>
          {/if}
        </li>
      {/each}
    </ul>
  </section>

  <!-- Foods by category -->
  <section class="space-y-3">
    <h2 class="font-display text-xl font-semibold">Aliments introduits par famille</h2>
    {#if data.categoryGroups.length === 0}
      <p class="text-sm text-muted-foreground">Aucun aliment encore noté.</p>
    {:else}
      <div class="space-y-3">
        {#each data.categoryGroups as g (g.id)}
          <div class="break-inside-avoid space-y-1.5">
            <div class="flex items-center gap-2">
              <CategoryTag id={g.id} size="sm" />
              <span class="text-xs text-muted-foreground">{g.foods.length}</span>
            </div>
            <ul class="grid gap-1 pl-1 text-sm sm:grid-cols-2 print:grid-cols-2">
              {#each g.foods as f (f.foodId)}
                {@const FoodIcon = reactionIcon(f.worstReaction)}
                <li
                  class="flex items-baseline justify-between gap-2 border-b pb-0.5 print:break-inside-avoid print:border-black/15"
                >
                  <span class="flex min-w-0 items-baseline gap-1.5">
                    <FoodIcon size={11} class={reactionClass(f.worstReaction)} aria-hidden="true" />
                    <!-- Truncate on screen to keep the grid tidy, but allow wrapping
                         in print so a long custom food name (e.g. "Purée de
                         courgette maison aux oignons") isn't silently ellipsis'd
                         out of the pediatric report. -->
                    <span class="truncate print:overflow-visible print:whitespace-normal">
                      {f.foodName}
                    </span>
                  </span>
                  <span class="shrink-0 text-xs text-muted-foreground">
                    {f.exposures}× · dès {fmtDay(f.firstGivenAt)}
                  </span>
                </li>
              {/each}
            </ul>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <!-- Notable reactions -->
  {#if data.notable.length > 0}
    <section class="space-y-3">
      <h2 class="font-display text-xl font-semibold">Réactions à signaler</h2>
      <ul class="space-y-2 text-sm">
        {#each data.notable as e (e.id)}
          {@const Icon = reactionIcon(e.reaction)}
          <li
            class="flex flex-col gap-1 border-b pb-1.5 print:break-inside-avoid print:border-black/15 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
          >
            <span class="flex min-w-0 items-baseline gap-1.5">
              <Icon size={12} class={reactionClass(e.reaction)} aria-hidden="true" />
              <span class="min-w-0">
                <strong>{e.foodName}</strong>
                <span class="text-xs text-muted-foreground"
                  >· {getCategoryLabel(e.category)}</span
                >
                {#if e.notes}
                  <span class="mt-0.5 block whitespace-pre-wrap text-xs text-muted-foreground">
                    {e.notes}
                  </span>
                {/if}
              </span>
            </span>
            <span
              class="shrink-0 whitespace-nowrap text-xs text-muted-foreground sm:self-baseline"
            >
              {fmtDay(e.givenAt)} · {getReactionLabel(e.reaction)}
            </span>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- Footer -->
  <footer class="space-y-1 border-t pt-3 text-[11px] text-muted-foreground print:border-black/20">
    <p>
      Édité depuis Diversif : application de suivi de la diversification alimentaire. Ce récap
      n'est pas un avis médical : présentez-le à votre pédiatre ou médecin pour discussion.
    </p>
    <p>
      Sources de référence : Santé publique France (PNNS), HCSP 2020, ANSES nourrissons, ESPGHAN
      2017, études LEAP (2015) et EAT (2016).
    </p>
  </footer>
</div>

<style>
  @media print {
    @page {
      size: A4;
      margin: 14mm 12mm;
    }
    :global(html),
    :global(body) {
      background: #fff !important;
      color: #000 !important;
    }
    :global(a) {
      color: inherit !important;
      text-decoration: none !important;
    }
  }
</style>
