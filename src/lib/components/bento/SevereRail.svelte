<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { Phone } from 'lucide-svelte';
</script>

<div role="alert" class="mb-3 rounded-tile bg-severe text-severe-foreground shadow-soft">
  <a href="tel:15" class="flex items-center gap-3 px-4 py-3">
    <Phone size={18} aria-hidden="true" />
    <p class="text-sm font-bold leading-tight">{m.reactionSevereRailBody()}</p>
  </a>
</div>
