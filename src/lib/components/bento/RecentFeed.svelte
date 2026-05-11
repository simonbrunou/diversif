<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { formatRelative } from '$lib/utils/dates';
  import { Apple, Beef, Wheat, Milk, Egg, Salad } from 'lucide-svelte';

  type Entry = {
    id: number;
    foodId: number;
    foodName: string;
    category: string;
    reaction: 'ras' | 'inconfort' | 'reaction';
    givenAt: number;
  };

  let { entries }: { entries: Entry[] } = $props();

  const visible = $derived(entries.slice(0, 5));

  const ICON_BY_CATEGORY: Record<string, typeof Apple> = {
    fruits: Apple,
    legumes: Salad,
    proteines: Beef,
    feculents: Wheat,
    'produits-laitiers': Milk,
    oeufs: Egg
  };

  function reactionLabel(r: Entry['reaction']): string {
    if (r === 'inconfort') return 'inconfort';
    if (r === 'reaction') return 'réaction';
    return 'RAS';
  }
</script>

<section class="mb-3">
  <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
    {m.aujourdhuiRecentTitle()}
  </h2>
  {#if visible.length === 0}
    <p class="rounded-tile border border-dashed border-border bg-canvas p-4 text-center text-sm text-ink-soft">
      {m.aujourdhuiRecentEmpty()}
    </p>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each visible as entry (entry.id)}
        {@const Icon = ICON_BY_CATEGORY[entry.category] ?? Apple}
        <li class="flex items-center gap-3 rounded-tile border border-border/40 bg-canvas px-3 py-2 shadow-soft">
          <span class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
            <Icon size={18} aria-hidden="true" />
          </span>
          <span class="flex-1">
            <p class="text-sm font-bold leading-tight">{entry.foodName}</p>
            <p class="text-xs text-ink-soft">{formatRelative(entry.givenAt)}</p>
          </span>
          <span class="rounded-full bg-tile-mint px-2 py-0.5 text-xs font-semibold">
            {reactionLabel(entry.reaction)}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</section>
