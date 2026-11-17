<script lang="ts">
  import SectionHeader from '#lib/components/ui/SectionHeader.svelte';
  import * as m from '#lib/paraglide/messages.js';
  import { cn } from '#lib/utils/cn.js';

  type Stage = { id: string; title: string; oneLiner: string };

  let {
    stages,
    activeStageId,
    onOpen
  }: { stages: Stage[]; activeStageId: string; onOpen: (id: string) => void } = $props();
</script>

<section class="mb-3">
  <SectionHeader>{m.decouvrirStagesTitle()}</SectionHeader>
  <div class="grid grid-cols-2 gap-3">
    {#each stages as stage (stage.id)}
      {@const active = stage.id === activeStageId}
      <!-- No aria-label: the tile's name is its title then its one-liner, the
           text a speech-input user sees (WCAG 2.5.3, #693). aria-current
           marks the current stage. -->
      <button
        type="button"
        onclick={() => onOpen(stage.id)}
        aria-current={active ? 'step' : undefined}
        class={cn(
          'rounded-tile bg-tile-lilac p-4 text-left text-tile-lilac-foreground shadow-soft transition-transform duration-base ease-soft hover:scale-101 active:scale-99',
          active && 'ring-2 ring-primary'
        )}
      >
        <p class="font-display text-xl italic leading-tight">{stage.title}</p>
        <p class="mt-1 text-xs">{stage.oneLiner}</p>
      </button>
    {/each}
  </div>
</section>
