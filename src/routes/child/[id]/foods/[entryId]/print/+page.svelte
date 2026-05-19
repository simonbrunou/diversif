<script lang="ts">
  import PrintShell from '$lib/components/PrintShell.svelte';
  import * as m from '$lib/paraglide/messages';
  import { severityOf, type SymptomLabel } from '$lib/content/symptoms';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function severityLabel(label: SymptomLabel): string {
    const s = severityOf(label);
    if (s === 'severe') return m.printSeveritySevere();
    if (s === 'warn') return m.printSeverityWarn();
    return m.printSeverityNeutral();
  }

  function symptomLabelText(l: SymptomLabel): string {
    const key = `symptomsLabel${l
      .split('-')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')}` as
      | 'symptomsLabelRougeur'
      | 'symptomsLabelUrticaire'
      | 'symptomsLabelEczema'
      | 'symptomsLabelVomissement'
      | 'symptomsLabelDiarrhee'
      | 'symptomsLabelGonflement'
      | 'symptomsLabelToux'
      | 'symptomsLabelDetresseRespiratoire'
      | 'symptomsLabelLevresBleues'
      | 'symptomsLabelAutre';
    return m[key]();
  }
</script>

<PrintShell title={m.printDocumentTitle()}>
  <header class="space-y-1 border-b pb-3">
    <h1 class="font-display text-2xl font-semibold leading-tight">
      {m.printDocumentTitle()}
    </h1>
    <p class="text-sm text-muted-foreground">
      {m.printChildHeader({ name: data.childName, months: String(data.months) })}
    </p>
  </header>

  <section class="space-y-2">
    <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {m.printFoodSection()}
    </h2>
    <p class="text-sm">{data.foodName} : {data.givenAt} ({data.reaction})</p>
  </section>

  <section class="space-y-2">
    <h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {m.printSymptomsSection()}
    </h2>
    {#if data.symptoms.length === 0}
      <p class="text-sm text-muted-foreground">—</p>
    {:else}
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th class="py-1.5 pr-3 font-medium">Heure</th>
            <th class="py-1.5 pr-3 font-medium">Symptôme</th>
            <th class="py-1.5 pr-3 font-medium">Note</th>
            <th class="py-1.5 font-medium">Sévérité</th>
          </tr>
        </thead>
        <tbody>
          {#each data.symptoms as s, i (i)}
            <tr class="border-b align-top print:border-black/15">
              <td class="py-1.5 pr-3 tabular-nums">{s.observedAt}</td>
              <td class="py-1.5 pr-3">{symptomLabelText(s.label)}</td>
              <td class="py-1.5 pr-3">{s.note ?? ''}</td>
              <td class="py-1.5">{severityLabel(s.label)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </section>

  <footer class="space-y-1 border-t pt-3 text-xs text-muted-foreground">
    <p>{m.printFooterNote()}</p>
    <p>{m.printGeneratedAt({ date: data.generatedAt })}</p>
  </footer>
</PrintShell>
