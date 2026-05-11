<script lang="ts">
  import FoodCardGrid from './FoodCardGrid.svelte';
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  type Food = {
    id: number;
    name: string;
    category: string;
    tried: number;
    status: 'ras' | 'inconfort' | 'reaction' | 'todo';
  };

  let { foods }: { foods: Food[] } = $props();

  let active = $state<string>('');

  const categories = $derived(Array.from(new Set(foods.map((f) => f.category))).sort());

  const filtered = $derived(active === '' ? foods : foods.filter((f) => f.category === active));
</script>

<div>
  <div class="mb-3 flex flex-wrap gap-2">
    <button
      type="button"
      onclick={() => (active = '')}
      class={cn(
        'rounded-full border px-3 py-1 text-xs font-semibold transition-transform duration-fast ease-soft active:scale-[0.97]',
        active === ''
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-canvas text-ink-soft'
      )}
    >
      {m.carnetTousFilterAll()}
    </button>
    {#each categories as cat (cat)}
      <button
        type="button"
        onclick={() => (active = cat)}
        class={cn(
          'rounded-full border px-3 py-1 text-xs font-semibold transition-transform duration-fast ease-soft active:scale-[0.97]',
          active === cat
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-canvas text-ink-soft'
        )}
      >
        {cat}
      </button>
    {/each}
  </div>
  {#key active}
    <div class="animate-fade-in-soft">
      {#if filtered.length === 0}
        <p class="rounded-tile border border-dashed border-border bg-canvas p-4 text-center text-sm text-ink-soft">
          {m.carnetTousEmpty()}
        </p>
      {:else}
        <FoodCardGrid items={filtered} />
      {/if}
    </div>
  {/key}
</div>
