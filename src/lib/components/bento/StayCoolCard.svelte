<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import { ChevronRight } from 'lucide-svelte';
</script>

<Card as="section" variant="tile-mint" class="mb-3 p-4">
  <p class="text-base font-bold leading-tight">{m.reactionStayCoolTitle()}</p>
  <p class="mt-1 text-sm text-tile-mint-foreground">{m.reactionStayCoolBody()}</p>
  <a
    href={localizedHref('/guide#reactions')}
    class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary-strong"
  >
    {m.reactionStayCoolLink()}
    <ChevronRight size={14} aria-hidden="true" />
  </a>
</Card>
