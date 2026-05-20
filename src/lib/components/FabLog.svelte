<script lang="ts">
  import { Plus } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  let {
    onclick,
    class: className = ''
  }: {
    onclick: () => void;
    class?: string;
  } = $props();
</script>

<button
  type="button"
  {onclick}
  aria-label={m.chromeFabLog()}
  class={cn(
    'flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform duration-base ease-spring hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    className
  )}
  style="height: 60px; width: 60px; view-transition-name: fab-log;"
>
  <Plus size={28} aria-hidden="true" />
</button>
