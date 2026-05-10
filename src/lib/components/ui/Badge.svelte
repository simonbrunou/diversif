<script lang="ts" module>
  export type BadgeVariant =
    | 'default'
    | 'secondary'
    | 'outline'
    | 'ras'
    | 'inconfort'
    | 'reaction'
    | 'severe';

  const VARIANTS: Record<BadgeVariant, string> = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-surface-2 text-foreground',
    outline: 'border border-border text-foreground',
    ras: 'bg-reaction-ras text-reaction-ras-foreground',
    inconfort: 'bg-reaction-inconfort text-reaction-inconfort-foreground',
    reaction: 'bg-reaction-reaction text-reaction-reaction-foreground',
    severe: 'bg-severe text-severe-foreground'
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
    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
    VARIANTS[variant],
    className
  )}
>
  {#if children}{@render children()}{/if}
</span>
