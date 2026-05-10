<script lang="ts" module>
  export type Variant =
    | 'default'
    | 'tile-peach'
    | 'tile-mint'
    | 'tile-butter'
    | 'tile-sky'
    | 'tile-lilac';

  const VARIANTS: Record<Variant, string> = {
    default: 'bg-card text-card-foreground border-border shadow-card',
    'tile-peach': 'bg-tile-peach text-tile-peach-foreground border-transparent',
    'tile-mint': 'bg-tile-mint text-tile-mint-foreground border-transparent',
    'tile-butter': 'bg-tile-butter text-tile-butter-foreground border-transparent',
    'tile-sky': 'bg-tile-sky text-tile-sky-foreground border-transparent',
    'tile-lilac': 'bg-tile-lilac text-tile-lilac-foreground border-transparent'
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    variant = 'default',
    class: className = '',
    children
  }: { variant?: Variant; class?: string; children?: Snippet } = $props();
</script>

<div class={cn('rounded-tile border', VARIANTS[variant], className)}>
  {#if children}{@render children()}{/if}
</div>
