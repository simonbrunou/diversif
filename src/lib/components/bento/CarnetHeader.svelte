<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  let { foodCount, categoryCount }: { foodCount: number; categoryCount: number } = $props();
</script>

<header class="mb-3">
  <h1 class="font-display text-3xl italic">{m.carnetTitle()}</h1>
  <p class="text-xs text-ink-soft">
    {m.carnetSub({ foodCount: String(foodCount), categoryCount: String(categoryCount) })}
  </p>
</header>
