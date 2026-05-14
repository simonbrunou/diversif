<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  let { foodCount, categoryCount }: { foodCount: number; categoryCount: number } = $props();

  const foodsLabel = $derived(
    foodCount === 1 ? m.carnetSubFoodsOne() : m.carnetSubFoodsOther({ count: String(foodCount) })
  );
  const categoriesLabel = $derived(
    categoryCount === 1
      ? m.carnetSubCategoriesOne()
      : m.carnetSubCategoriesOther({ count: String(categoryCount) })
  );
</script>

<header class="mb-3">
  <h1 class="font-display text-3xl italic">{m.carnetTitle()}</h1>
  <p class="truncate text-xs text-ink-soft">{foodsLabel} · {categoriesLabel}</p>
</header>
