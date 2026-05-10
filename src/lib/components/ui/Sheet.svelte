<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    title?: string;
    description?: string;
    side?: 'bottom' | 'top';
    class?: string;
    children?: Snippet;
  };

  let {
    open = $bindable(false),
    onOpenChange,
    title,
    description,
    side = 'bottom',
    class: className = '',
    children
  }: Props = $props();

  const sideClasses = {
    bottom:
      'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-hero data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
    top: 'inset-x-0 top-0 max-h-[92dvh] rounded-b-hero data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top'
  };
</script>

<DialogPrimitive.Root bind:open {onOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogPrimitive.Content
      class={cn(
        'fixed z-50 grid w-full gap-4 border border-border bg-surface p-5 pb-8 shadow-lifted duration-slow ease-spring data-[state=open]:animate-in data-[state=closed]:animate-out',
        sideClasses[side],
        className
      )}
    >
      {#if side === 'bottom'}
        <div data-sheet-grabber class="mx-auto h-1 w-9 rounded-full bg-border"></div>
      {/if}
      {#if title}
        <DialogPrimitive.Title class="font-display text-xl italic">
          {title}
        </DialogPrimitive.Title>
      {/if}
      {#if description}
        <DialogPrimitive.Description class="text-sm text-ink-soft">
          {description}
        </DialogPrimitive.Description>
      {/if}
      {#if children}{@render children()}{/if}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
