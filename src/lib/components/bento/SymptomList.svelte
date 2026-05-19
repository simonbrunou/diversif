<script lang="ts">
  import SymptomRow from './SymptomRow.svelte';
  import DashedActionRow from '$components/ui/DashedActionRow.svelte';
  import EmptyHint from '$components/ui/EmptyHint.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { Plus } from 'lucide-svelte';
  import type { SymptomEntry } from '$lib/types';

  let {
    symptoms,
    onAdd,
    action
  }: { symptoms: SymptomEntry[]; onAdd: () => void; action: string } = $props();
</script>

<section class="mb-3">
  <SectionHeader>{m.reactionSymptomsTitle()}</SectionHeader>
  {#if symptoms.length === 0}
    <EmptyHint class="mb-2">{m.reactionSymptomsEmpty()}</EmptyHint>
  {:else}
    <ul class="mb-2 flex flex-col gap-2">
      {#each symptoms as s (s.id)}
        <SymptomRow
          id={s.id}
          label={s.label}
          observedAt={s.observedAt}
          note={s.note}
          {action}
        />
      {/each}
    </ul>
  {/if}
  <DashedActionRow onclick={onAdd} icon={Plus} class="flex w-full justify-center">
    {m.reactionSymptomsAdd()}
  </DashedActionRow>
</section>
