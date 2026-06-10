<!-- src/lib/components/bento/CarnetCategories.svelte -->
<script lang="ts">
  import FoodCard from './FoodCard.svelte';
  import EmptyHint from '$components/ui/EmptyHint.svelte';
  import { getCategoryLabel } from '$lib/utils/categories';
  import * as m from '$lib/paraglide/messages';

  type Food = {
    id: number;
    name: string;
    category: string;
    tried: number;
    status: 'ras' | 'inconfort' | 'reaction' | 'todo';
  };

  let { foods }: { foods: Food[] } = $props();

  const grouped = $derived(
    foods.reduce<Record<string, Food[]>>((acc, f) => {
      (acc[f.category] ??= []).push(f);
      return acc;
    }, {})
  );

  const categories = $derived(Object.keys(grouped).sort());
</script>

{#if categories.length === 0}
  <EmptyHint class="p-4">{m.carnetCategoriesEmpty()}</EmptyHint>
{:else}
  <div class="flex flex-col gap-2">
    {#each categories as cat (cat)}
      <details
        data-category={cat}
        class="rounded-tile border border-border/40 bg-canvas p-3 shadow-soft"
      >
        <summary class="cursor-pointer text-sm font-semibold uppercase tracking-wider text-ink-soft">
          {getCategoryLabel(cat)} ({grouped[cat].length})
        </summary>
        <div class="relative">
          <div class="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto">
            {#each grouped[cat] as f (f.id)}
              <div class="min-w-[8rem] shrink-0 snap-start">
                <FoodCard name={f.name} category={f.category} tried={f.tried} status={f.status} />
              </div>
            {/each}
          </div>
          <div
            class="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-canvas to-transparent"
            aria-hidden="true"
          ></div>
        </div>
      </details>
    {/each}
  </div>
{/if}
