<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    class: className = '',
    children
  }: {
    class?: string;
    children: Snippet;
  } = $props();
</script>

<p
  class={cn(
    'rounded-tile border border-dashed border-border bg-canvas p-3 text-center text-sm text-ink-soft',
    className
  )}
>
  {@render children()}
</p>
