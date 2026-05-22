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
  import { useBottomSheetDrag } from './use-bottom-sheet-drag.svelte';

  type Props = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    side?: ModalSide;
    title?: string;
    description?: string;
    class?: string;
    /**
     * When true, wraps `children` in a `max-h-[70vh] overflow-y-auto` container
     * so long body content scrolls instead of clipping. Required for any
     * `side="auto"` / `side="bottom"` sheet whose body can grow taller than
     * the 92dvh sheet limit — without it, the lower portion (including the
     * close button) becomes unreachable on mobile.
     *
     * NOTE: a flex-1 approach was tried (Bundle 2) to claim the remaining
     * space inside the 92dvh sheet, but `DialogPrimitive.Content` is laid
     * out as a CSS grid, not a flex column, so `flex-1` has no effect there.
     * Reverting to a 70vh ceiling restores working scroll. The audit-flagged
     * "dead space below the sheet" requires a layout-level fix in the
     * grid template, tracked for a follow-up.
     */
    scrollableBody?: boolean;
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
    scrollableBody = false,
    children,
    footer,
    onclose
  }: Props = $props();

  // Resolve `side="auto"` against the viewport. Tailwind's `md` breakpoint
  // is 768px; below that we render the bottom sheet (with drag-to-dismiss
  // and inner-scroll handling), at md+ we render a center modal.
  // Seeded synchronously from matchMedia on the client so a `side="auto"`
  // modal mounted-already-open on desktop renders directly as a center
  // modal — without this, the first paint would briefly use the bottom
  // sheet classes/grabber before the $effect flipped isDesktop true.
  const DESKTOP_MEDIA_QUERY = '(min-width: 768px)';
  let isDesktop = $state(
    typeof window !== 'undefined' ? window.matchMedia(DESKTOP_MEDIA_QUERY).matches : false
  );

  $effect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(DESKTOP_MEDIA_QUERY);
    // Initial value is already seeded above; this effect just keeps
    // isDesktop in sync with later viewport changes (rotation, resize).
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
      'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-hero pb-[max(2rem,env(safe-area-inset-bottom))] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
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

  const drag = useBottomSheetDrag({
    active: () => resolvedSide === 'bottom',
    isOpen: () => open,
    close: () => handleOpenChange(false)
  });
</script>

<DialogPrimitive.Root bind:open onOpenChange={handleOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      data-dialog-overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm duration-slow data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in"
    />
    <DialogPrimitive.Content
      data-side={resolvedSide}
      class={cn(
        'fixed z-50 grid w-full gap-4 border border-border bg-surface p-5 shadow-lifted duration-slow ease-spring data-[state=closed]:animate-out data-[state=open]:animate-in',
        // touch-none keeps the browser from claiming the vertical pan
        // (which would dispatch pointercancel mid-drag and snap the
        // sheet back). Inner scroll for scrollable descendants is
        // driven manually in the composable's 'scroll' branch.
        resolvedSide === 'bottom' && 'touch-none',
        sideClasses[resolvedSide],
        className
      )}
      style={drag.sheetStyle}
      onpointerdown={drag.onSheetPointerDown}
      onpointermove={drag.onSheetPointerMove}
      onpointerup={drag.onSheetPointerUp}
      onpointercancel={drag.onSheetPointerCancel}
    >
      {#if resolvedSide === 'bottom'}
        <div
          class="tap-target -mt-2 mb-1 flex cursor-grab items-center justify-center py-2 active:cursor-grabbing"
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
      {#if children}
        {#if scrollableBody}
          <div class="max-h-[70vh] overflow-y-auto">{@render children()}</div>
        {:else}
          {@render children()}
        {/if}
      {/if}
      {#if footer}
        <div class="flex justify-end gap-2">{@render footer()}</div>
      {/if}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
