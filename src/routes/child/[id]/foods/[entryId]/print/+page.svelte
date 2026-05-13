<script lang="ts">
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

<svelte:head>
  <title>{m.printDocumentTitle()}</title>
</svelte:head>

<div class="print-doc">
  <h1>{m.printDocumentTitle()}</h1>
  <p>{m.printChildHeader({ name: data.childName, months: String(data.months) })}</p>

  <h2>{m.printFoodSection()}</h2>
  <p>{data.foodName} : {data.givenAt} ({data.reaction})</p>

  <h2>{m.printSymptomsSection()}</h2>
  {#if data.symptoms.length === 0}
    <p>—</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Heure</th>
          <th>Symptôme</th>
          <th>Note</th>
          <th>Sévérité</th>
        </tr>
      </thead>
      <tbody>
        {#each data.symptoms as s, i (i)}
          <tr>
            <td>{s.observedAt}</td>
            <td>{symptomLabelText(s.label)}</td>
            <td>{s.note ?? ''}</td>
            <td>{severityLabel(s.label)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <footer>
    <p>{m.printFooterNote()}</p>
    <p>{m.printGeneratedAt({ date: data.generatedAt })}</p>
  </footer>
</div>

<style>
  :global(body) {
    background: white;
    color: black;
    font-family: ui-sans-serif, system-ui, sans-serif;
    margin: 0;
  }
  .print-doc {
    max-width: 720px;
    margin: 0 auto;
    padding: 24px;
  }
  .print-doc h1 {
    font-size: 20px;
    margin: 0 0 8px 0;
  }
  .print-doc h2 {
    font-size: 14px;
    margin: 24px 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .print-doc table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .print-doc th,
  .print-doc td {
    border-bottom: 1px solid #ddd;
    padding: 6px 4px;
    text-align: left;
  }
  .print-doc footer {
    margin-top: 32px;
    font-size: 12px;
    color: #555;
  }
  @media print {
    .print-doc {
      padding: 0;
    }
  }
</style>
