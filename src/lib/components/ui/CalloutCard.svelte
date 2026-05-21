<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import type { Icon as LucideIcon } from 'lucide-svelte';

  let {
    class: className = '',
    title,
    icon,
    action,
    children
  }: {
    class?: string;
    title: string;
    icon?: typeof LucideIcon;
    action?: Snippet;
    children: Snippet;
  } = $props();

  const Icon = $derived(icon);
</script>

<div
  class={cn(
    'flex flex-col items-center justify-center rounded-tile border border-dashed border-border bg-canvas px-6 py-10 text-center',
    className
  )}
>
  {#if Icon}
    <div
      class="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface text-primary-strong shadow-card"
    >
      <Icon size={26} aria-hidden="true" />
    </div>
  {/if}
  <h2 class="text-base font-semibold">{title}</h2>
  <p class="mt-1 max-w-sm text-sm text-ink-soft">
    {@render children()}
  </p>
  {#if action}
    <div class="mt-4">{@render action()}</div>
  {/if}
</div>
