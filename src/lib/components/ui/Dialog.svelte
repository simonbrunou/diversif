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

  let panel = $state<HTMLDivElement | null>(null);
  let previouslyFocused: HTMLElement | null = null;

  const FOCUSABLE_SELECTOR =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusableElements(): HTMLElement[] {
    if (!panel) return [];
    return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  // Move focus into the dialog when it opens, and restore it to whatever had
  // focus before — mirrors the pattern WCAG SC 2.4.3 expects for modals so
  // keyboard and AT users aren't dropped at the top of the document on close.
  $effect(() => {
    if (!open) return;
    previouslyFocused = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
    queueMicrotask(() => {
      const els = focusableElements();
      (els[0] ?? panel)?.focus();
    });
    return () => {
      previouslyFocused?.focus?.();
      previouslyFocused = null;
    };
  });

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
      return;
    }
    if (e.key !== 'Tab') return;
    // Trap Tab inside the panel so focus can't escape into the page behind.
    const els = focusableElements();
    if (els.length === 0) {
      e.preventDefault();
      panel?.focus();
      return;
    }
    const first = els[0];
    const last = els[els.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !panel?.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
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
      bind:this={panel}
      tabindex="-1"
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
