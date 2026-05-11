<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { ChevronRight } from 'lucide-svelte';

  let { childId }: { childId: string } = $props();
</script>

<section class="mb-3 rounded-tile bg-tile-mint p-4 shadow-soft">
  <p class="text-base font-bold leading-tight">{m.reactionStayCoolTitle()}</p>
  <p class="mt-1 text-sm text-tile-mint-foreground">{m.reactionStayCoolBody()}</p>
  <a
    href={`/child/${childId}/guide#reactions`}
    class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary"
  >
    {m.reactionStayCoolLink()}
    <ChevronRight size={14} aria-hidden="true" />
  </a>
</section>
