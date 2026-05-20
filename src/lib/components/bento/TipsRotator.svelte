<script lang="ts">
  import Card from '$components/ui/Card.svelte';
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
    <Card as="article" variant="tile-butter" class="p-4">
      <div class="flex items-start justify-between gap-3">
        <div class="flex-1">
          <p class="text-base font-bold leading-tight">{tip.title}</p>
          <p class="mt-1 text-sm text-ink-soft">{tip.body}</p>
        </div>
        <button
          type="button"
          onclick={() => onDismiss(tip.id)}
          class="inline-flex min-h-11 items-center rounded-full bg-surface px-3 text-xs font-semibold text-ink-soft transition-transform duration-fast ease-soft active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {m.decouvrirTipDismiss()}
        </button>
      </div>
    </Card>
  </section>
{/if}
