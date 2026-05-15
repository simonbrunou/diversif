<script lang="ts" module>
  // 'auto' = bottom sheet on mobile, center modal on md+ viewports. Use for
  // forms / longer detail content; keep `center` for alerts and brief intro
  // dialogs that should look the same on every viewport.
  export type ModalSide = 'top' | 'right' | 'bottom' | 'left' | 'center' | 'auto';
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

  // Resolve `side="auto"` against the viewport. Tailwind's `md` breakpoint
  // is 768px; below that we render the bottom sheet (with drag-to-dismiss
  // and inner-scroll handling), at md+ we render a center modal.
  let isDesktop = $state(false);

  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    isDesktop = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      isDesktop = e.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });

  type ResolvedSide = Exclude<ModalSide, 'auto'>;
  const resolvedSide = $derived<ResolvedSide>(
    side === 'auto' ? (isDesktop ? 'center' : 'bottom') : side
  );

  const sideClasses: Record<ResolvedSide, string> = {
    top: 'inset-x-0 top-0 max-h-[92dvh] rounded-b-hero data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
    right:
      'inset-y-0 right-0 flex h-full w-3/4 max-w-xs flex-col data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
    bottom:
      'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-hero pb-8 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
    left: 'inset-y-0 left-0 flex h-full w-3/4 max-w-xs flex-col data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
    // Center sits at left/top 50% with `-translate-x/y-1/2` for true
    // centering. tailwindcss-animate animates the whole `transform`
    // property, so without matching translate-1/2 anchors on the
    // animation variables the modal would drift from translate(0,0)
    // toward translate(-50%,-50%) on every open/close. The slide-*-1/2
    // utilities pin the enter `from` / exit `to` to the centering
    // transform so only the scale + opacity actually animate.
    center:
      'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-hero data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-1/2 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2'
  };

  function handleOpenChange(v: boolean) {
    open = v;
    onOpenChange?.(v);
    if (!v) onclose?.();
  }

  const DRAG_THRESHOLD_PX = 100;
  const DRAG_VELOCITY_THRESHOLD = 0.5;
  // Minimum downward movement before a pointer-down on the sheet body
  // commits to a drag gesture (so a tap or short flick doesn't drag the
  // sheet a few pixels and snap back).
  const DRAG_TRIGGER_PX = 8;
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
  // 'pending' = pointer is down but the user hasn't moved past the trigger
  // distance yet; 'scroll' = the press started on a scrolled-down content
  // area, so we drive the scroll ourselves until scrollTop reaches 0;
  // 'drag' = we own the gesture and are translating the sheet by inline
  // transform.
  let gestureMode: 'idle' | 'pending' | 'scroll' | 'drag' = 'idle';
  let startY = 0;
  let startTime = 0;
  let lastMoveY = 0;
  let activeScrollable: HTMLElement | null = null;
  let activePointerId: number | null = null;
  let releaseTimer: ReturnType<typeof setTimeout> | null = null;

  const sheetStyle = $derived.by(() => {
    if (resolvedSide !== 'bottom') return undefined;
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

  function resetGesture() {
    gestureMode = 'idle';
    activeScrollable = null;
    activePointerId = null;
  }

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
      resetGesture();
    } else if (!dismissingFromDrag) {
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      dragY = 0;
      dragging = false;
      releasing = false;
      resetGesture();
    }
  });

  // Belt-and-braces: if the parent unmounts Modal while a snap-back or
  // dismiss-reset timer is still pending (route change mid-drag), kill it
  // so the callback can't fire against a destroyed component.
  $effect(() => {
    return () => {
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
    };
  });

  // If the viewport crosses the md breakpoint mid-gesture (rotation, resize),
  // resolvedSide flips away from 'bottom' and every pointer handler early-
  // returns — leaving gestureMode/dragging/activePointerId stuck on the
  // last drag state. Wipe everything when the side leaves 'bottom' so the
  // bottom handlers re-engage cleanly if the viewport comes back.
  $effect(() => {
    if (resolvedSide !== 'bottom') {
      if (releaseTimer) {
        clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      dragY = 0;
      dragging = false;
      releasing = false;
      dismissingFromDrag = false;
      resetGesture();
    }
  });

  function isInteractive(target: Element | null, root: HTMLElement): boolean {
    let node: Element | null = target;
    while (node && node !== root) {
      const tag = node.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        tag === 'A' ||
        tag === 'LABEL'
      )
        return true;
      if (node instanceof HTMLElement && node.isContentEditable) return true;
      const role = node.getAttribute('role');
      if (role === 'button' || role === 'link' || role === 'menuitem' || role === 'tab')
        return true;
      node = node.parentElement;
    }
    return false;
  }

  function findScrollable(target: Element | null, root: HTMLElement): HTMLElement | null {
    let el: Element | null = target;
    while (el && el !== root) {
      if (el instanceof HTMLElement) {
        const style = getComputedStyle(el);
        if (
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight
        ) {
          return el;
        }
      }
      el = el.parentElement;
    }
    return null;
  }

  function onSheetPointerDown(e: PointerEvent) {
    if (resolvedSide !== 'bottom') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Ignore additional pointers while a gesture is already in flight
    // (e.g. a thumb landing during a one-finger drag). Setting capture
    // only happens after the 8px commit, so without this guard a second
    // pointerdown would clobber activePointerId/startY and strand the
    // first finger's state.
    if (gestureMode !== 'idle') return;

    const root = e.currentTarget as HTMLElement;
    const target = e.target as Element;

    // Don't intercept clicks/taps on form controls or other interactive
    // elements — they need to receive the pointerdown unmolested.
    if (isInteractive(target, root)) return;

    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }

    startY = e.clientY;
    startTime = performance.now();
    lastMoveY = e.clientY;
    activePointerId = e.pointerId;
    dismissingFromDrag = false;

    // Capture immediately so we still receive pointermove/up if the user
    // drags or releases outside the sheet bounds (without this, a mouse
    // press released off-sheet before the 8px threshold would never
    // deliver pointerup, leaving gestureMode stuck on 'pending').
    try {
      root.setPointerCapture(e.pointerId);
    } catch {
      /* happy-dom and some environments throw — ignore */
    }

    const isTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const scrollable = findScrollable(target, root);
    activeScrollable = scrollable;

    if (isTouch && scrollable) {
      // We own scroll for the whole press (Content has touch-action: none).
      // 'scroll' mode drives scrollTop in either direction; if a downward
      // drag pins scrollTop to 0 and the finger keeps pulling, the move
      // handler hands off to the drag-to-dismiss gesture.
      gestureMode = 'scroll';
    } else {
      gestureMode = 'pending';
    }
  }

  function onSheetPointerMove(e: PointerEvent) {
    if (resolvedSide !== 'bottom') return;
    if (gestureMode === 'idle') return;
    if (e.pointerId !== activePointerId) return;

    const currentY = e.clientY;
    const incrementalDy = currentY - lastMoveY;
    lastMoveY = currentY;

    if (gestureMode === 'scroll') {
      // Content has touch-action: none, so native scroll is off — drive
      // the scrollable manually in both directions. The setter clamps to
      // [0, scrollHeight - clientHeight], so an extra downward pull at
      // the top (or an extra upward pull at the bottom) just stays put.
      // Once scrollTop is pinned at 0 and the finger is still pulling
      // down, hand off to the drag-to-dismiss gesture.
      if (activeScrollable) {
        activeScrollable.scrollTop -= incrementalDy;
        if (activeScrollable.scrollTop <= 0 && currentY > startY) {
          gestureMode = 'pending';
          startY = currentY;
          startTime = performance.now();
        }
      }
      return;
    }

    // In pending or drag mode: claim the pointer so the browser can't
    // reclassify our drag as a native gesture (which would dispatch
    // pointercancel and snap the sheet back).
    if (e.cancelable) e.preventDefault();

    const dy = currentY - startY;

    if (gestureMode === 'pending') {
      if (dy >= DRAG_TRIGGER_PX) {
        gestureMode = 'drag';
        dragging = true;
      } else if (dy <= -DRAG_TRIGGER_PX) {
        // Upward movement before drag was committed: not our gesture.
        resetGesture();
        return;
      } else {
        return;
      }
    }

    if (gestureMode === 'drag') {
      dragY = Math.max(0, dy);
    }
  }

  function onSheetPointerUp(e: PointerEvent) {
    if (resolvedSide !== 'bottom') return;
    if (e.pointerId !== activePointerId) return;

    const wasDragging = gestureMode === 'drag';
    resetGesture();

    if (!wasDragging) return;

    const delta = e.clientY - startY;
    const duration = performance.now() - startTime;
    const velocity = delta / Math.max(duration, 1);
    dragging = false;

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

  function onSheetPointerCancel(e: PointerEvent) {
    if (resolvedSide !== 'bottom') return;
    if (e.pointerId !== activePointerId) return;

    const wasDragging = gestureMode === 'drag';
    resetGesture();

    // A system gesture interrupted the drag (notch swipe, app backgrounding,
    // etc.). The user did not deliberately complete the swipe, so snap back
    // even if the drag had already crossed the dismiss threshold.
    if (!wasDragging) return;
    dragging = false;
    if (dragY === 0) return;
    dragY = 0;
    releasing = true;
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      releasing = false;
    }, SNAP_RESET_MS);
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
        // touch-none keeps the browser from claiming the vertical pan
        // (which would dispatch pointercancel mid-drag and snap the
        // sheet back). Inner scroll for scrollable descendants is
        // driven manually in onSheetPointerMove's 'scroll' branch.
        resolvedSide === 'bottom' && 'touch-none',
        sideClasses[resolvedSide],
        className
      )}
      style={sheetStyle}
      onpointerdown={onSheetPointerDown}
      onpointermove={onSheetPointerMove}
      onpointerup={onSheetPointerUp}
      onpointercancel={onSheetPointerCancel}
    >
      {#if resolvedSide === 'bottom'}
        <div
          class="-mt-2 mb-1 flex cursor-grab justify-center py-2 active:cursor-grabbing"
          role="presentation"
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
