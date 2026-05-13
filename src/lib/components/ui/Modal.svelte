<script lang="ts" module>
  export type ModalSide = 'top' | 'right' | 'bottom' | 'left' | 'center';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    side?: ModalSide;
    title?: string;
    description?: string;
    class?: string;
    children?: Snippet;
    footer?: Snippet;
    onclose?: () => void;
  };

  let {
    open = $bindable(false),
    onOpenChange,
    side = 'center',
    title,
    description,
    class: className = '',
    children,
    footer,
    onclose
  }: Props = $props();

  const sideClasses: Record<ModalSide, string> = {
    top: 'inset-x-0 top-0 max-h-[92dvh] rounded-b-hero data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
    right:
      'inset-y-0 right-0 flex h-full w-3/4 max-w-xs flex-col data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
    bottom:
      'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-hero pb-8 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
    left: 'inset-y-0 left-0 flex h-full w-3/4 max-w-xs flex-col data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
    center:
      'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-hero data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'
  };

  function handleOpenChange(v: boolean) {
    open = v;
    onOpenChange?.(v);
    if (!v) onclose?.();
  }
</script>

<DialogPrimitive.Root bind:open onOpenChange={handleOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in"
    />
    <DialogPrimitive.Content
      class={cn(
        'fixed z-50 grid w-full gap-4 border border-border bg-surface p-5 shadow-lifted duration-slow ease-spring data-[state=closed]:animate-out data-[state=open]:animate-in',
        sideClasses[side],
        className
      )}
    >
      {#if side === 'bottom'}
        <div data-sheet-grabber class="mx-auto h-1 w-9 rounded-full bg-border"></div>
      {/if}
      {#if title}
        <DialogPrimitive.Title class="font-display text-xl italic leading-tight">
          {title}
        </DialogPrimitive.Title>
      {:else}
        <!-- bits-ui requires a Title for AT; render a hidden one when the
             caller doesn't provide a visible heading. -->
        <DialogPrimitive.Title class="sr-only">Dialogue</DialogPrimitive.Title>
      {/if}
      {#if description}
        <DialogPrimitive.Description class="text-sm text-ink-soft">
          {description}
        </DialogPrimitive.Description>
      {/if}
      {#if children}{@render children()}{/if}
      {#if footer}
        <div class="flex justify-end gap-2">{@render footer()}</div>
      {/if}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
