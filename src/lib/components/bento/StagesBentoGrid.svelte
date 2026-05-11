<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  type Stage = { id: string; title: string; oneLiner: string };

  let {
    stages,
    activeStageId,
    onOpen
  }: { stages: Stage[]; activeStageId: string; onOpen: (id: string) => void } = $props();
</script>

<section class="mb-3" aria-label={m.decouvrirStagesTitle()}>
  <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
    {m.decouvrirStagesTitle()}
  </h2>
  <div class="grid grid-cols-2 gap-3">
    {#each stages as stage (stage.id)}
      {@const active = stage.id === activeStageId}
      <button
        type="button"
        onclick={() => onOpen(stage.id)}
        aria-current={active ? 'step' : undefined}
        aria-label={`${stage.title} — ${active ? m.decouvrirStageActiveAria() : m.decouvrirStageOpenAria()}`}
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
</section>
