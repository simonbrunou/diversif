<script lang="ts" module>
  export type BadgeVariant = 'default' | 'secondary' | 'outline' | 'ras' | 'inconfort' | 'reaction';

  const VARIANTS: Record<BadgeVariant, string> = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-secondary text-secondary-foreground',
    outline: 'border border-input text-foreground',
    ras: 'bg-reaction-ras/15 text-reaction-ras border border-reaction-ras/30',
    inconfort: 'bg-reaction-inconfort/15 text-reaction-inconfort border border-reaction-inconfort/30',
    reaction: 'bg-reaction-reaction/15 text-reaction-reaction border border-reaction-reaction/30'
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    variant = 'default',
    class: className = '',
    children
  }: { variant?: BadgeVariant; class?: string; children?: Snippet } = $props();
</script>

<span
  class={cn(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
    VARIANTS[variant],
    className
  )}
>
  {#if children}{@render children()}{/if}
</span>
