<script lang="ts" module>
  export type Variant =
    | 'default'
    | 'secondary'
    | 'outline'
    | 'ghost'
    | 'destructive'
    | 'tile-peach'
    | 'tile-mint'
    | 'tile-butter'
    | 'tile-sky'
    | 'tile-lilac';
  export type Size = 'default' | 'sm' | 'lg' | 'icon' | 'pill';

  const VARIANTS: Record<Variant, string> = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-card',
    secondary: 'bg-surface-2 text-foreground hover:bg-surface-2/80',
    outline: 'border border-input bg-surface hover:bg-surface-2 text-foreground',
    ghost: 'hover:bg-surface-2 text-foreground',
    destructive: 'bg-severe text-severe-foreground hover:bg-severe/90 shadow-card',
    'tile-peach': 'bg-tile-peach text-tile-peach-foreground hover:bg-tile-peach/90',
    'tile-mint': 'bg-tile-mint text-tile-mint-foreground hover:bg-tile-mint/90',
    'tile-butter': 'bg-tile-butter text-tile-butter-foreground hover:bg-tile-butter/90',
    'tile-sky': 'bg-tile-sky text-tile-sky-foreground hover:bg-tile-sky/90',
    'tile-lilac': 'bg-tile-lilac text-tile-lilac-foreground hover:bg-tile-lilac/90'
  };

  const SIZES: Record<Size, string> = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-9 px-3 text-sm',
    lg: 'h-12 px-6 text-base',
    icon: 'h-10 w-10',
    pill: 'h-11 px-5 text-sm font-bold rounded-full'
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import { Loader2 } from 'lucide-svelte';

  type Props = {
    variant?: Variant;
    size?: Size;
    class?: string;
    href?: string;
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    onclick?: (event: MouseEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
  };

  let {
    variant = 'default',
    size = 'default',
    class: className = '',
    href,
    type = 'button',
    disabled = false,
    loading = false,
    onclick,
    children,
    ...rest
  }: Props = $props();

  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-base ease-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  const iconSize = $derived(size === 'lg' ? 18 : 16);
</script>

{#if href}
  <a {href} class={cn(base, VARIANTS[variant], SIZES[size], className)} {...rest}>
    {#if children}{@render children()}{/if}
  </a>
{:else}
  <button
    {type}
    disabled={disabled || loading}
    class={cn(base, VARIANTS[variant], SIZES[size], className)}
    {onclick}
    {...rest}
  >
    {#if loading}
      <Loader2 size={iconSize} class="animate-spin" aria-hidden="true" />
    {/if}
    {#if children}{@render children()}{/if}
  </button>
{/if}
