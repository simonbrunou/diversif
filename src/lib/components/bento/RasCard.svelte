<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  let { nth }: { nth: number } = $props();
</script>

<section class="mb-3 rounded-tile bg-tile-mint p-4 shadow-soft">
  <p class="text-sm font-semibold text-tile-mint-foreground">
    {m.reactionRasMessage({ nth: String(nth) })}
  </p>
</section>
