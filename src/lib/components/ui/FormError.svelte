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
    // `text-destructive` is the coral background hue (≈2.4:1 on canvas, worse
    // on the destructive-tinted card). `text-severe-text` is the readable
    // warm-red ink token defined in app.css for both themes.
    'rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-severe-text',
    className
  )}
>
  {@render children()}
</div>
