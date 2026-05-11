<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { Phone } from 'lucide-svelte';
</script>

<!-- svelte-ignore a11y_no_interactive_element_to_noninteractive_role -->
<a
  href="tel:15"
  role="alert"
  class="mb-3 flex items-center gap-3 rounded-tile bg-severe px-4 py-3 text-severe-foreground shadow-soft"
>
  <Phone size={18} aria-hidden="true" />
  <p class="text-sm font-bold leading-tight">{m.reactionSevereRailBody()}</p>
</a>
