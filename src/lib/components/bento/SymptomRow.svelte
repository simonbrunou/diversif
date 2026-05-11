<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { severityOf, type SymptomLabel } from '$lib/content/symptoms';
  import { cn } from '$lib/utils/cn';

  let {
    label,
    observedAt,
    note
  }: { label: SymptomLabel; observedAt: string; note: string | null } = $props();

  const severity = $derived(severityOf(label));

  function labelText(l: SymptomLabel): string {
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

<li
  aria-live={severity === 'severe' ? 'polite' : undefined}
  class={cn(
    'flex items-start gap-3 rounded-tile border px-3 py-2 shadow-soft',
    severity === 'neutral' && 'border-border bg-surface',
    severity === 'warn' && 'border-warning bg-tile-butter',
    severity === 'severe' && 'border-severe bg-severe text-severe-foreground'
  )}
>
  <span class="font-mono text-xs">{observedAt}</span>
  <span class="flex-1">
    <p class="text-sm font-bold">{labelText(label)}</p>
    {#if note}
      <p class="text-xs">{note}</p>
    {/if}
  </span>
</li>
