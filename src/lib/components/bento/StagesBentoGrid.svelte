<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';
  import { ChevronDown } from 'lucide-svelte';

  type Stage = { id: string; title: string; oneLiner: string };

  let {
    stages,
    activeStageId,
    onOpen
  }: { stages: Stage[]; activeStageId: string; onOpen: (id: string) => void } = $props();

  let expanded = $state(false);

  const activeStage = $derived(stages.find((s) => s.id === activeStageId) ?? null);
  const canCollapse = $derived(activeStage !== null && stages.length > 1);
  const visibleStages = $derived(
    expanded || !canCollapse ? stages : activeStage ? [activeStage] : stages
  );
</script>

<section class="mb-3">
  <SectionHeader>{m.decouvrirStagesTitle()}</SectionHeader>
  <div class={cn('grid gap-3', expanded || !canCollapse ? 'grid-cols-2' : 'grid-cols-1')}>
    {#each visibleStages as stage (stage.id)}
      {@const active = stage.id === activeStageId}
      <button
        type="button"
        onclick={() => onOpen(stage.id)}
        aria-current={active ? 'step' : undefined}
        aria-label={`${stage.title} : ${active ? m.decouvrirStageActiveAria() : m.decouvrirStageOpenAria()}`}
        class={cn(
          'rounded-tile bg-tile-lilac p-4 text-left shadow-soft transition-transform duration-base ease-soft hover:scale-[1.01] active:scale-[0.99]',
          active && 'ring-2 ring-primary'
        )}
      >
        <p class="font-display text-lg italic leading-tight">{stage.title}</p>
        <p class="mt-1 text-xs text-ink-soft">{stage.oneLiner}</p>
      </button>
    {/each}
  </div>
  {#if canCollapse}
    <button
      type="button"
      onclick={() => (expanded = !expanded)}
      aria-expanded={expanded}
      class="mt-2 flex w-full items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-ink-soft transition-colors duration-base ease-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {expanded ? m.decouvrirStagesVoirMoins() : m.decouvrirStagesVoirToutes()}
      <ChevronDown
        size={14}
        aria-hidden="true"
        class={cn('transition-transform duration-base ease-soft', expanded && 'rotate-180')}
      />
    </button>
  {/if}
</section>
