// Drag-to-dismiss gesture for the Modal bottom-sheet variant.
//
// Extracted from Modal.svelte to keep that component focused on layout +
// composition. The state machine below owns:
//   - pointer down/move/up/cancel handlers
//   - the 4-state gesture mode (idle | pending | scroll | drag)
//   - scroll-handoff: pointer-down on a scrolled-down inner area drives
//     scroll manually until scrollTop hits 0, then promotes to drag
//   - inline transform during drag + snap-back vs dismiss release branch
//   - $effect-driven cleanup whenever `open` flips or the viewport leaves
//     the bottom-sheet breakpoint mid-gesture
//
// The composable returns the four DOM handlers + a derived `sheetStyle`
// string. Callers wire those into the sheet container; everything else is
// transparently managed by the runes-backed state inside this module.

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

export type BottomSheetDragOptions = {
  /**
   * True only when the sheet is currently rendered as a bottom sheet
   * (i.e. `resolvedSide === 'bottom'`). All pointer handlers early-return
   * when this is false. When it flips to false mid-gesture, an effect
   * wipes the gesture state so the handlers re-engage cleanly later.
   */
  active: () => boolean;
  /** True while the modal is open (bound from the parent). */
  isOpen: () => boolean;
  /** Called to close the sheet when the user releases past the dismiss threshold. */
  close: () => void;
};

export type BottomSheetDrag = {
  /**
   * Inline style string to apply to the sheet container during drag /
   * snap-back / dismiss-from-drag. Undefined the rest of the time so the
   * tailwindcss-animate keyframes can drive the transform unencumbered.
   */
  readonly sheetStyle: string | undefined;
  onSheetPointerDown: (e: PointerEvent) => void;
  onSheetPointerMove: (e: PointerEvent) => void;
  onSheetPointerUp: (e: PointerEvent) => void;
  onSheetPointerCancel: (e: PointerEvent) => void;
};

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
    if (role === 'button' || role === 'link' || role === 'menuitem' || role === 'tab') return true;
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

export function useBottomSheetDrag(options: BottomSheetDragOptions): BottomSheetDrag {
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
    if (!options.active()) return undefined;
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

  function clearTimer() {
    if (releaseTimer) {
      clearTimeout(releaseTimer);
      releaseTimer = null;
    }
  }

  function fullReset() {
    clearTimer();
    dragY = 0;
    dragging = false;
    releasing = false;
    resetGesture();
  }

  // Cancel a pending timer and reset drag state whenever `open` changes.
  // On reopen, this wipes any stale styles left over from the previous
  // dismiss (the dismiss path keeps the inline transform applied until
  // bits-ui unmounts the content, so cleanup has to happen on the next
  // open). On external close (Escape, overlay click, parent setter),
  // it cancels a snap-back-in-flight; skip during dismiss-from-drag so
  // the off-screen slide can finish before bits-ui tears the sheet down.
  $effect(() => {
    if (options.isOpen()) {
      fullReset();
      dismissingFromDrag = false;
    } else if (!dismissingFromDrag) {
      fullReset();
    }
  });

  // Belt-and-braces: if the parent unmounts the composable while a snap-back
  // or dismiss-reset timer is still pending (route change mid-drag), kill it
  // so the callback can't fire against a destroyed component.
  $effect(() => {
    return () => {
      clearTimer();
    };
  });

  // If the viewport crosses the md breakpoint mid-gesture (rotation, resize),
  // `active` flips to false and every pointer handler early-returns — leaving
  // gestureMode/dragging/activePointerId stuck on the last drag state. Wipe
  // everything when the sheet leaves the bottom variant so the bottom
  // handlers re-engage cleanly if the viewport comes back. Skip during
  // dismiss-from-drag so the exit animation can finish.
  $effect(() => {
    if (!options.active() && !dismissingFromDrag) {
      fullReset();
    }
  });

  function onSheetPointerDown(e: PointerEvent) {
    if (!options.active()) return;
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

    clearTimer();

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

  // Content has touch-action: none, so native scroll is off — drive
  // the scrollable manually in both directions. The setter clamps to
  // [0, scrollHeight - clientHeight], so an extra downward pull at
  // the top (or an extra upward pull at the bottom) just stays put.
  // Once scrollTop is pinned at 0 and the finger is still pulling
  // down, hand off to the drag-to-dismiss gesture.
  function driveScrollHandoff(currentY: number, incrementalDy: number) {
    if (!activeScrollable) return;
    activeScrollable.scrollTop -= incrementalDy;
    if (activeScrollable.scrollTop <= 0 && currentY > startY) {
      gestureMode = 'pending';
      startY = currentY;
      startTime = performance.now();
    }
  }

  // Resolve a pending gesture against the trigger distance: commit to a
  // drag once the finger has moved DRAG_TRIGGER_PX downward, bail out on
  // an equivalent upward move (not our gesture), or stay pending. Returns
  // true when the move should continue into the drag branch.
  function commitPendingGesture(dy: number): boolean {
    if (dy >= DRAG_TRIGGER_PX) {
      gestureMode = 'drag';
      dragging = true;
      return true;
    }
    if (dy <= -DRAG_TRIGGER_PX) {
      // Upward movement before drag was committed: not our gesture.
      resetGesture();
    }
    return false;
  }

  function onSheetPointerMove(e: PointerEvent) {
    if (!options.active()) return;
    if (gestureMode === 'idle') return;
    if (e.pointerId !== activePointerId) return;

    const currentY = e.clientY;
    const incrementalDy = currentY - lastMoveY;
    lastMoveY = currentY;

    if (gestureMode === 'scroll') {
      driveScrollHandoff(currentY, incrementalDy);
      return;
    }

    // In pending or drag mode: claim the pointer so the browser can't
    // reclassify our drag as a native gesture (which would dispatch
    // pointercancel and snap the sheet back).
    if (e.cancelable) e.preventDefault();

    const dy = currentY - startY;

    if (gestureMode === 'pending' && !commitPendingGesture(dy)) return;

    if (gestureMode === 'drag') {
      dragY = Math.max(0, dy);
    }
  }

  function onSheetPointerUp(e: PointerEvent) {
    if (!options.active()) return;
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
      options.close();
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
    if (!options.active()) return;
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

  return {
    get sheetStyle() {
      return sheetStyle;
    },
    onSheetPointerDown,
    onSheetPointerMove,
    onSheetPointerUp,
    onSheetPointerCancel
  };
}
