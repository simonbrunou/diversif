<script lang="ts">
  import PrintShell from '$lib/components/PrintShell.svelte';
  import ReportSummaryStats from '$lib/components/report/ReportSummaryStats.svelte';
  import ReportStageStatus from '$lib/components/report/ReportStageStatus.svelte';
  import ReportTextureDistribution from '$lib/components/report/ReportTextureDistribution.svelte';
  import ReportAllergensGrid from '$lib/components/report/ReportAllergensGrid.svelte';
  import ReportFoodsByCategory from '$lib/components/report/ReportFoodsByCategory.svelte';
  import ReportNotableReactions from '$lib/components/report/ReportNotableReactions.svelte';
  import { formatAge } from '$lib/utils/age';
  import { localizedHref } from '$lib/utils/localized-href';
  import { formatReportDay } from '$lib/utils/report';
  import * as m from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<PrintShell title="{m.reportHandoffTitle()} : {data.child.name} · Diversif">
  {#snippet toolbarStart()}
    <a
      href={localizedHref(`/child/${data.child.id}`)}
      class="text-sm text-muted-foreground hover:underline"
    >
      ← {m.reportBackToDashboard()}
    </a>
  {/snippet}

  <!-- Document header -->
  <header class="space-y-2 border-b pb-4">
    <div
      class="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground"
    >
      <span>{m.reportHeaderEyebrow()}</span>
      <span>{m.reportHeaderEditedOn({ date: formatReportDay(data.generatedAt) })}</span>
    </div>
    <h1 class="font-display text-3xl font-semibold leading-tight md:text-4xl">
      {data.child.name}
    </h1>
    <p class="text-sm text-muted-foreground">
      {formatAge(data.child.birthDate)} · {data.ageMonths < 4
        ? m.preDiversificationTitle()
        : data.stage.title}
    </p>
  </header>

  <ReportSummaryStats totals={data.totals} />

  <ReportStageStatus
    ageMonths={data.ageMonths}
    stage={data.stage}
    mostAdvancedTexture={data.mostAdvancedTexture}
  />

  <ReportTextureDistribution textureDistribution={data.textureDistribution} />

  <ReportAllergensGrid allergens={data.allergens} />

  <ReportFoodsByCategory categoryGroups={data.categoryGroups} />

  {#if data.notable.length > 0}
    <ReportNotableReactions notable={data.notable} />
  {/if}

  <!-- Footer -->
  <footer class="space-y-1 border-t pt-3 text-2xs text-muted-foreground print:border-black/20">
    <p>{m.reportFooterDisclaimer()}</p>
    <p>{m.reportFooterSources()}</p>
  </footer>

  <!-- Print-only date stamp. Locale follows the active UI language so an
       English-locale parent doesn't get a French long-date stamp. -->
  <p class="mt-4 hidden text-center text-xs text-muted-foreground print:block">
    {m.reportPrintedOn({
      date: new Intl.DateTimeFormat(getLocale(), { dateStyle: 'long' }).format(
        new Date(data.generatedAt)
      )
    })}
  </p>
</PrintShell>
