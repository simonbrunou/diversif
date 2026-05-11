<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  type Status = 'ras' | 'inconfort' | 'reaction' | 'todo';

  let {
    name,
    category,
    tried,
    status
  }: { name: string; category: string; tried: number; status: Status } = $props();

  const isUntried = $derived(tried === 0);
</script>

<article
  class={cn(
    'flex flex-col gap-1 rounded-tile bg-canvas p-3 shadow-soft',
    isUntried ? 'border border-dashed border-border' : 'border border-border/40'
  )}
  data-category={category}
  data-status={status}
>
  <p class="text-sm font-bold leading-tight">{name}</p>
  <p class="text-xs text-ink-soft">
    {isUntried ? m.carnetFoodCardUntried() : m.carnetFoodCardTried({ count: String(tried) })}
  </p>
</article>
