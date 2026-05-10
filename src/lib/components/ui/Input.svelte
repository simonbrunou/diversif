<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils/cn';

  type Props = HTMLInputAttributes & { class?: string };
  let { class: className = '', value = $bindable(), ...rest }: Props = $props();
</script>

<input
  class={cn(
    'flex h-11 w-full rounded-lg border-2 border-border bg-canvas px-4 py-2 text-sm text-foreground transition-colors duration-base ease-soft file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-ink-soft focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  bind:value
  {...rest}
/>
