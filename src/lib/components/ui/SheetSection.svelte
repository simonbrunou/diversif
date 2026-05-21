<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import type { Icon as LucideIcon } from 'lucide-svelte';

  let {
    title,
    icon,
    class: className = '',
    children
  }: {
    title: string;
    icon?: typeof LucideIcon;
    class?: string;
    children: Snippet;
  } = $props();

  const Icon = $derived(icon);
</script>

<section class={cn('mt-4 first:mt-0', className)}>
  <h2
    class="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft"
  >
    {#if Icon}
      <Icon size={14} aria-hidden="true" />
    {/if}
    {title}
  </h2>
  {@render children()}
</section>
