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
    /** Optional headline rendered above the body. Triggers the richer layout. */
    title?: string;
    /** Optional Lucide icon rendered above the title in the richer layout. */
    icon?: typeof LucideIcon;
    /** Optional CTA snippet rendered below the body. */
    action?: Snippet;
    children: Snippet;
  } = $props();

  const Icon = $derived(icon);
  const rich = $derived(Boolean(title || Icon || action));
</script>

{#if rich}
  <div
    class={cn(
      'flex flex-col items-center justify-center rounded-tile border border-dashed border-border bg-canvas px-6 py-10 text-center',
      className
    )}
  >
    {#if Icon}
      <div
        class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-primary-strong shadow-soft"
      >
        <Icon size={22} aria-hidden="true" />
      </div>
    {/if}
    {#if title}
      <h2 class="text-base font-semibold">{title}</h2>
    {/if}
    <p class="mt-1 max-w-sm text-sm text-ink-soft">
      {@render children()}
    </p>
    {#if action}
      <div class="mt-4">{@render action()}</div>
    {/if}
  </div>
{:else}
  <p
    class={cn(
      'rounded-tile border border-dashed border-border bg-canvas p-3 text-center text-sm text-ink-soft',
      className
    )}
  >
    {@render children()}
  </p>
{/if}
