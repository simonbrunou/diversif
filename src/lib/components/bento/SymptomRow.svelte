<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import { severityOf, type SymptomLabel } from '$lib/content/symptoms';
  import { cn } from '$lib/utils/cn';
  import { X } from 'lucide-svelte';

  let {
    id,
    label,
    observedAt,
    note,
    action
  }: {
    id: number;
    label: SymptomLabel;
    observedAt: string;
    note: string | null;
    action: string;
  } = $props();

  const severity = $derived(severityOf(label));
  let confirmOpen = $state(false);

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
  <button
    type="button"
    aria-label={m.reactionSymptomsDelete()}
    title={m.reactionSymptomsDelete()}
    onclick={() => (confirmOpen = true)}
    class="inline-flex h-7 w-7 items-center justify-center rounded-full text-current opacity-60 transition hover:opacity-100"
  >
    <X size={14} aria-hidden="true" />
  </button>
  <ConfirmModal
    bind:open={confirmOpen}
    title={m.reactionSymptomsDeleteConfirm()}
    action={`${action}?/deleteSymptom`}
    confirmLabel={m.reactionSymptomsDelete()}
    loadingLabel={m.reactionSymptomsDeleting()}
    destructive
    hiddenFields={{ symptomId: id }}
    failureMessage={m.errorsGenericFallback()}
  />
</li>
