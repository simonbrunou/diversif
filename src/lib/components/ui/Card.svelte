<script lang="ts" module>
  export type Variant =
    | 'default'
    | 'surface'
    | 'tile-peach'
    | 'tile-mint'
    | 'tile-butter'
    | 'tile-sky'
    | 'tile-lilac';
  export type Padding = 'sm' | 'md' | 'lg';

  const VARIANTS: Record<Variant, string> = {
    default: 'bg-card text-card-foreground border-border shadow-card',
    surface: 'bg-surface text-foreground border-transparent shadow-soft',
    'tile-peach': 'bg-tile-peach text-tile-peach-foreground border-transparent shadow-soft',
    'tile-mint': 'bg-tile-mint text-tile-mint-foreground border-transparent shadow-soft',
    'tile-butter': 'bg-tile-butter text-tile-butter-foreground border-transparent shadow-soft',
    'tile-sky': 'bg-tile-sky text-tile-sky-foreground border-transparent shadow-soft',
    'tile-lilac': 'bg-tile-lilac text-tile-lilac-foreground border-transparent shadow-soft'
  };

  const PADDING: Record<Padding, string> = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5'
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    as = 'div',
    variant = 'default',
    padding,
    class: className = '',
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    children
  }: {
    as?: 'div' | 'section' | 'article';
    variant?: Variant;
    padding?: Padding;
    class?: string;
    id?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    children?: Snippet;
  } = $props();

  const paddingClass = $derived(padding ? PADDING[padding] : '');
</script>

{#if as === 'section'}
  <section
    {id}
    class={cn('rounded-tile border', VARIANTS[variant], paddingClass, className)}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
  >
    {#if children}{@render children()}{/if}
  </section>
{:else if as === 'article'}
  <article
    {id}
    class={cn('rounded-tile border', VARIANTS[variant], paddingClass, className)}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
  >
    {#if children}{@render children()}{/if}
  </article>
{:else}
  <div
    {id}
    class={cn('rounded-tile border', VARIANTS[variant], paddingClass, className)}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
