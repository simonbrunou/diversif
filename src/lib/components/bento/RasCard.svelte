<script lang="ts">
  import Card from '#lib/components/ui/Card.svelte';
  import * as m from '#lib/paraglide/messages.js';

  let { nth }: { nth: number } = $props();
</script>

<Card as="section" variant="tile-mint" class="mb-3 p-4">
  <p class="text-sm font-semibold text-tile-mint-foreground">
    {m.reactionRasMessage({ nth: String(nth) })}
  </p>
</Card>
