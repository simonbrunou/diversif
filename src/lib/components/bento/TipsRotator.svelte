<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';

  type Tip = { id: string; title: string; body: string };

  let {
    tip,
    dismissed,
    onDismiss
  }: { tip: Tip | null; dismissed: boolean; onDismiss: (id: string) => void } = $props();
</script>

{#if tip && !dismissed}
  <section class="mb-3">
    <SectionHeader>{m.decouvrirTipsTitle()}</SectionHeader>
    <article class="rounded-tile bg-tile-butter p-4 shadow-soft">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1">
          <p class="text-base font-bold leading-tight">{tip.title}</p>
          <p class="mt-1 text-sm text-ink-soft">{tip.body}</p>
        </div>
        <button
          type="button"
          onclick={() => onDismiss(tip.id)}
          class="rounded-full bg-surface px-2 py-1 text-xs font-semibold text-ink-soft transition-transform duration-fast ease-soft active:scale-[0.97]"
        >
          {m.decouvrirTipDismiss()}
        </button>
      </div>
    </article>
  </section>
{/if}
