<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    open = $bindable(false),
    class: className = '',
    title,
    description,
    children,
    footer,
    onclose
  }: {
    open?: boolean;
    class?: string;
    title?: string;
    description?: string;
    children?: Snippet;
    footer?: Snippet;
    onclose?: () => void;
  } = $props();

  function handleBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      open = false;
      onclose?.();
    }
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      open = false;
      onclose?.();
    }
  }
</script>

<svelte:window onkeydown={open ? handleKey : null} />

{#if open}
  <div
    role="dialog"
    aria-modal="true"
    aria-label={title}
    tabindex="-1"
    class="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
    onmousedown={handleBackdrop}
  >
    <div
      class={cn(
        'w-full max-w-md rounded-lg border bg-card p-6 shadow-lg outline-none',
        className
      )}
    >
      {#if title}
        <h2 class="text-lg font-semibold">{title}</h2>
      {/if}
      {#if description}
        <p class="mt-1 text-sm text-muted-foreground">{description}</p>
      {/if}
      {#if children}
        <div class="mt-4">{@render children()}</div>
      {/if}
      {#if footer}
        <div class="mt-6 flex justify-end gap-2">{@render footer()}</div>
      {/if}
    </div>
  </div>
{/if}
