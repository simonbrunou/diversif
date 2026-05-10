<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    side?: 'left' | 'right';
    class?: string;
    children?: Snippet;
  };

  let {
    open = $bindable(false),
    onOpenChange,
    side = 'right',
    class: className = '',
    children
  }: Props = $props();

  const sideClasses = {
    left: 'inset-y-0 left-0 w-3/4 max-w-xs data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
    right:
      'inset-y-0 right-0 w-3/4 max-w-xs data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
  };
</script>

<DialogPrimitive.Root bind:open {onOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out"
    />
    <DialogPrimitive.Content
      class={cn(
        'fixed z-50 flex h-full flex-col gap-4 border border-border bg-surface p-5 shadow-lifted duration-slow ease-spring data-[state=open]:animate-in data-[state=closed]:animate-out',
        sideClasses[side],
        className
      )}
    >
      {#if children}{@render children()}{/if}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
