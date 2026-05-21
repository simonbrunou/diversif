<script lang="ts" module>
  export type Variant = 'warning' | 'info' | 'success';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import { AlertTriangle, Info, Check, type Icon as LucideIcon } from 'lucide-svelte';

  let {
    variant,
    title,
    class: className = '',
    children
  }: {
    variant: Variant;
    title?: string;
    class?: string;
    children: Snippet;
  } = $props();

  const SURFACES: Record<Variant, string> = {
    warning: 'bg-warning text-warning-foreground border-warning/40',
    info: 'bg-tile-sky text-tile-sky-foreground border-tile-sky/40',
    success: 'bg-tile-mint text-tile-mint-foreground border-tile-mint/40'
  };

  const ICONS: Record<Variant, typeof LucideIcon> = {
    warning: AlertTriangle,
    info: Info,
    success: Check
  };

  const Icon = $derived(ICONS[variant]);
</script>

<aside
  role="note"
  class={cn(
    'flex items-start gap-2 rounded-tile border p-3 text-sm',
    SURFACES[variant],
    className
  )}
>
  <Icon size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
  <div class="min-w-0 flex-1">
    {#if title}
      <p class="mb-1 font-semibold">{title}</p>
    {/if}
    {@render children()}
  </div>
</aside>
