<script lang="ts">
  import type { HTMLSelectAttributes } from 'svelte/elements';
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import { ChevronDown } from 'lucide-svelte';

  type Props = HTMLSelectAttributes & {
    class?: string;
    children?: Snippet;
  };

  let { class: className = '', value = $bindable(), children, ...rest }: Props = $props();
</script>

<div class="relative">
  <select
    class={cn(
      'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    bind:value
    {...rest}
  >
    {#if children}{@render children()}{/if}
  </select>
  <ChevronDown
    size={16}
    class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
    aria-hidden="true"
  />
</div>
