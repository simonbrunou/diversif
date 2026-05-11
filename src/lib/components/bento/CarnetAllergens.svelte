<!-- src/lib/components/bento/CarnetAllergens.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  type Item = {
    id: string;
    label: string;
    triedCount: number;
    lastTried: string | null;
    state: 'cleared' | 'todo' | 'reaction';
  };

  let { items }: { items: Item[] } = $props();

  function stateLabel(s: Item['state']): string {
    if (s === 'cleared') return m.aujourdhuiAllergensOk();
    if (s === 'reaction') return 'réaction observée';
    return m.aujourdhuiAllergensTodo();
  }
</script>

{#if items.length === 0}
  <p class="rounded-tile border border-dashed border-border bg-canvas p-4 text-center text-sm text-ink-soft">
    {m.carnetAllergensEmpty()}
  </p>
{:else}
  <ul class="flex flex-col gap-2">
    {#each items as item (item.id)}
      <li
        class={cn(
          'flex items-center justify-between rounded-tile border border-border/40 bg-canvas p-3 shadow-soft',
          item.state === 'reaction' && 'border-severe/40 bg-tile-coral/20'
        )}
      >
        <div>
          <p class="text-sm font-bold leading-tight">{item.label}</p>
          <p class="text-xs text-ink-soft">
            {item.triedCount}× · {item.lastTried ?? '—'}
          </p>
        </div>
        <span
          class={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            item.state === 'cleared' && 'bg-tile-mint',
            item.state === 'todo' && 'bg-tile-butter',
            item.state === 'reaction' && 'bg-tile-coral text-tile-coral-foreground'
          )}
        >
          {stateLabel(item.state)}
        </span>
      </li>
    {/each}
  </ul>
{/if}
