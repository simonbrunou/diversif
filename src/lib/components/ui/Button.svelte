<script lang="ts" module>
  export type Variant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  export type Size = 'default' | 'sm' | 'lg' | 'icon';

  const VARIANTS: Record<Variant, string> = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-card',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-card'
  };

  const SIZES: Record<Size, string> = {
    default: 'h-10 px-4 py-2 text-sm',
    sm: 'h-9 px-3 text-sm',
    lg: 'h-12 px-6 text-base',
    icon: 'h-10 w-10'
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
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
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
