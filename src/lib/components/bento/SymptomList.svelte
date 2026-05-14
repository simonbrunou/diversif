<script lang="ts">
  import SymptomRow from './SymptomRow.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { Plus } from 'lucide-svelte';
  import type { SymptomLabel } from '$lib/content/symptoms';

  type SymptomEntry = { id: number; label: SymptomLabel; observedAt: string; note: string | null };

  let {
    symptoms,
    onAdd
  }: { symptoms: SymptomEntry[]; onAdd: () => void } = $props();
</script>

<section class="mb-3">
  <SectionHeader>{m.reactionSymptomsTitle()}</SectionHeader>
  {#if symptoms.length === 0}
    <p class="mb-2 rounded-tile border border-dashed border-border bg-canvas p-3 text-center text-sm text-ink-soft">
      {m.reactionSymptomsEmpty()}
    </p>
  {:else}
    <ul class="mb-2 flex flex-col gap-2">
      {#each symptoms as s (s.id)}
        <SymptomRow label={s.label} observedAt={s.observedAt} note={s.note} />
      {/each}
    </ul>
  {/if}
  <button
    type="button"
    onclick={onAdd}
    class="flex w-full items-center justify-center gap-2 rounded-tile border border-dashed border-border bg-canvas px-3 py-2 text-sm font-semibold text-ink-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    <Plus size={16} aria-hidden="true" />
    {m.reactionSymptomsAdd()}
  </button>
</section>
