<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  type Tint = 'mint' | 'peach' | 'butter';

  let {
    label,
    tint,
    children
  }: {
    label: string;
    tint: Tint;
    children: Snippet;
  } = $props();

  const tintClass = $derived(
    tint === 'mint'
      ? 'bg-tile-mint/[0.18]'
      : tint === 'peach'
        ? 'bg-tile-peach/[0.18]'
        : 'bg-tile-butter/[0.18]'
  );

  const labelTintClass = $derived(
    tint === 'mint'
      ? 'text-tile-mint-foreground'
      : tint === 'peach'
        ? 'text-tile-peach-foreground'
        : 'text-tile-butter-foreground'
  );
</script>

<!--
  The `discover-group` / `discover-group__label` class names are retained as
  test hooks for DiscoverGroup.test.ts (they no longer carry any CSS — styling
  is fully Tailwind-driven via tintClass / labelTintClass).
-->
<section
  class={cn('discover-group rounded-hero p-3 mb-6 sm:p-4', tintClass)}
  data-tint={tint}
  aria-label={label}
>
  <p
    class={cn(
      'discover-group__label text-xs font-semibold uppercase tracking-wider mb-2 ml-1',
      labelTintClass
    )}
    aria-hidden="true"
  >
    {label}
  </p>
  {@render children()}
</section>
