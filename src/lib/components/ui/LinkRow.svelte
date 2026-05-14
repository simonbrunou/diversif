<script lang="ts" module>
  export type LinkRowVariant =
    | 'surface'
    | 'tile-peach'
    | 'tile-mint'
    | 'tile-butter'
    | 'tile-sky'
    | 'tile-lilac';

  const VARIANTS: Record<LinkRowVariant, string> = {
    surface: 'bg-surface text-foreground',
    'tile-peach': 'bg-tile-peach text-tile-peach-foreground',
    'tile-mint': 'bg-tile-mint text-tile-mint-foreground',
    'tile-butter': 'bg-tile-butter text-tile-butter-foreground',
    'tile-sky': 'bg-tile-sky text-tile-sky-foreground',
    'tile-lilac': 'bg-tile-lilac text-tile-lilac-foreground'
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    href,
    variant = 'surface',
    lift = false,
    class: className = '',
    'aria-label': ariaLabel,
    children
  }: {
    href: string;
    variant?: LinkRowVariant;
    lift?: boolean;
    class?: string;
    'aria-label'?: string;
    children: Snippet;
  } = $props();
</script>

<a
  {href}
  aria-label={ariaLabel}
  class={cn(
    'flex items-center gap-3 rounded-tile px-3 py-3 shadow-soft transition-transform duration-base ease-soft active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none',
    lift && 'hover:scale-[1.01]',
    VARIANTS[variant],
    className
  )}
>
  {@render children()}
</a>
