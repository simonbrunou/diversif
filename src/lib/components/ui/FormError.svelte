<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    class: className = '',
    children
  }: { class?: string; children: Snippet } = $props();
</script>

<div
  role="alert"
  class={cn(
    'rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive',
    className
  )}
>
  {@render children()}
</div>
