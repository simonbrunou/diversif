<script lang="ts" module>
  export type ModalSide = 'top' | 'right' | 'bottom' | 'left' | 'center';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';
  import * as m from '$lib/paraglide/messages';

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

  const DRAG_THRESHOLD_PX = 100;
  const DRAG_VELOCITY_THRESHOLD = 0.5;
  const SNAP_TRANSITION_MS = 220;
  const SNAP_RESET_MS = 240;
  // tailwindcss-animate exit runs at duration-slow (--dur-slow = 360ms).
  // Wait past the exit animation + bits-ui unmount tick before clearing
  // the inline transform so the element is gone by then and a CSS reset
  // can't flash on its way out.
  const DISMISS_RESET_MS = 400;

  let dragY = $state(0);
  let dragging = $state(false);
  let releasing = $state(false);
  let dismissingFromDrag = $state(false);
  let startY = 0;
  let startTime = 0;
  let releaseTimer: ReturnType<typeof setTimeout> | null = null;

  const sheetStyle = $derived.by(() => {
    if (side !== 'bottom') return undefined;
    if (!dragging && !releasing) return undefined;
    // During drag and during dismiss-from-drag, no inline transition:
    // the finger drives the transform in the first case, and the
    // tailwindcss-animate slide-out-to-bottom keyframe interpolates
    // from the inline translate in the second.
    const transition =
      dragging || dismissingFromDrag
        ? 'none'
        : `transform ${SNAP_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
    return `transform: translateY(${dragY}px); transition: ${transition};`;
  });

  // Cancel a pending timer and reset drag state whenever `open` changes.
  // On reopen, this wipes any stale styles left over from the previous
  // dismiss (the dismiss path keeps the inline transform applied until
  // bits-ui unmounts the content, so cleanup has to happen on the next
  // open). On external close (Escape, overlay click, parent setter),
  // it cancels a snap-back-in-flight; skip during dismiss-from-drag so
  // the off-screen slide can finish before bits-ui tears the sheet down.
  $effect(() => {
    if (open) {
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      dragY = 0;
      dragging = false;
      releasing = false;
      dismissingFromDrag = false;
    } else if (!dismissingFromDrag) {
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      dragY = 0;
      dragging = false;
      releasing = false;
    }
  });

  function onGrabberPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }
    startY = e.clientY;
    startTime = performance.now();
    dragging = true;
    releasing = false;
    dismissingFromDrag = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onGrabberPointerMove(e: PointerEvent) {
    if (!dragging) return;
    dragY = Math.max(0, e.clientY - startY);
  }

  function onGrabberPointerCancel() {
    // A system gesture interrupted the drag (notch swipe, app backgrounding,
    // etc.). The user did not deliberately complete the swipe, so snap back
    // even if the drag had already crossed the dismiss threshold.
    if (!dragging) return;
    dragging = false;
    if (dragY === 0) return;
    dragY = 0;
    releasing = true;
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      releasing = false;
    }, SNAP_RESET_MS);
  }

  function onGrabberPointerUp(e: PointerEvent) {
    if (!dragging) return;
    const delta = e.clientY - startY;
    const duration = performance.now() - startTime;
    const velocity = delta / Math.max(duration, 1);
    dragging = false;

    // Tap or upward drag: dragY is already 0, no animation needed.
    if (dragY === 0) return;

    if (delta >= DRAG_THRESHOLD_PX || velocity >= DRAG_VELOCITY_THRESHOLD) {
      // Dismiss: keep dragY + releasing set so the inline transform
      // remains the underlying value when tailwindcss-animate's
      // slide-out-to-bottom keyframe starts. The keyframe's implicit
      // `from` is sampled at animation start, so the exit interpolates
      // from the released drag position to translate(0, 100%) rather
      // than snapping back to translateY(0) first.
      dismissingFromDrag = true;
      releasing = true;
      handleOpenChange(false);
      releaseTimer = setTimeout(() => {
        releaseTimer = null;
        dragY = 0;
        releasing = false;
        dismissingFromDrag = false;
      }, DISMISS_RESET_MS);
    } else {
      dragY = 0;
      releasing = true;
      releaseTimer = setTimeout(() => {
        releaseTimer = null;
        releasing = false;
      }, SNAP_RESET_MS);
    }
  }
</script>

<DialogPrimitive.Root bind:open onOpenChange={handleOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm duration-slow data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in"
    />
    <DialogPrimitive.Content
      class={cn(
        'fixed z-50 grid w-full gap-4 border border-border bg-surface p-5 shadow-lifted duration-slow ease-spring data-[state=closed]:animate-out data-[state=open]:animate-in',
        sideClasses[side],
        className
      )}
      style={sheetStyle}
    >
      {#if side === 'bottom'}
        <div
          class="-mt-2 mb-1 flex touch-none cursor-grab justify-center py-2 active:cursor-grabbing"
          role="presentation"
          onpointerdown={onGrabberPointerDown}
          onpointermove={onGrabberPointerMove}
          onpointerup={onGrabberPointerUp}
          onpointercancel={onGrabberPointerCancel}
        >
          <span data-sheet-grabber class="h-1 w-9 rounded-full bg-border"></span>
        </div>
      {/if}
      {#if title}
        <DialogPrimitive.Title class="font-display text-xl italic leading-tight">
          {title}
        </DialogPrimitive.Title>
      {:else}
        <!-- bits-ui requires a Title for AT; render a hidden one when the
             caller doesn't provide a visible heading. -->
        <DialogPrimitive.Title class="sr-only">{m.modalDialogFallbackTitle()}</DialogPrimitive.Title>
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
