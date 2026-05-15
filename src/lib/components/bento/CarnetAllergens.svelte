<!-- src/lib/components/bento/CarnetAllergens.svelte -->
<script lang="ts">
  import { Sparkles } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  type Item = {
    id: string;
    label: string;
    triedCount: number;
    lastTried: string | null;
    daysSinceLastTried: number | null;
    state: 'cleared' | 'todo' | 'reaction' | 'fading';
  };

  let { items }: { items: Item[] } = $props();

  function stateLabel(s: Item['state']): string {
    if (s === 'cleared') return m.aujourdhuiAllergensOk();
    if (s === 'reaction') return 'réaction';
    if (s === 'fading') return m.aujourdhuiAllergensFading();
    return m.aujourdhuiAllergensTodo();
  }

  function caption(it: Item): string {
    if (it.state === 'fading' && it.daysSinceLastTried !== null) {
      return `${it.triedCount}× · ${m.carnetAllergensFadingCaption({ days: String(it.daysSinceLastTried) })}`;
    }
    return `${it.triedCount}× · ${it.lastTried ?? '—'}`;
  }
</script>

{#if items.length === 0}
  <div class="flex flex-col items-center gap-3 rounded-tile border border-dashed border-border bg-canvas py-8">
    <Sparkles class="h-6 w-6 text-ink-soft" aria-hidden="true" />
    <p class="text-center text-sm text-ink-soft">
      {m.carnetAllergensEmpty()}
    </p>
  </div>
{:else}
  <ul class="flex flex-col gap-2">
    {#each items as item (item.id)}
      <li
        class={cn(
          'flex items-center justify-between rounded-tile border border-border/40 bg-canvas p-3 shadow-soft',
          item.state === 'reaction' && 'border-severe/40 bg-tile-coral/20',
          item.state === 'fading' && 'border-tile-peach-foreground/30 bg-tile-peach/20'
        )}
      >
        <div>
          <p class="text-sm font-bold leading-tight">{item.label}</p>
          <p class="text-xs text-ink-soft">
            {caption(item)}
          </p>
        </div>
        <span
          class={cn(
            'rounded-full px-2 py-0.5 text-xs font-semibold',
            item.state === 'cleared' && 'bg-tile-mint',
            item.state === 'todo' && 'bg-tile-butter',
            item.state === 'reaction' && 'bg-tile-coral text-tile-coral-foreground',
            item.state === 'fading' && 'bg-tile-peach text-tile-peach-foreground'
          )}
        >
          {stateLabel(item.state)}
        </span>
      </li>
    {/each}
  </ul>
{/if}
