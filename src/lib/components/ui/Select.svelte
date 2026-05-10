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
      'flex h-11 w-full appearance-none rounded-lg border-2 border-border bg-canvas px-4 pr-9 py-2 text-sm text-foreground transition-colors duration-base ease-soft placeholder:text-ink-soft',
      'focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0',
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
    class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft"
    aria-hidden="true"
  />
</div>
