// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Modal from './Modal.svelte';

afterEach(async () => {
  cleanup();
  // bits-ui releases its body-scroll lock on a short timeout. Let that cleanup
  // run while happy-dom's document still exists so it cannot fire after the
  // test environment has been torn down.
  await new Promise((resolve) => setTimeout(resolve, 50));
});

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(Modal, { props: { open: false, children: text('hidden') } });
    expect(screen.queryByText('hidden')).toBeNull();
  });

  it('renders children when open', () => {
    render(Modal, { props: { open: true, children: text('visible') } });
    expect(screen.getByText('visible')).toBeTruthy();
  });

  it('renders the bottom grabber for side="bottom"', () => {
    render(Modal, { props: { open: true, side: 'bottom', children: text('x') } });
    expect(document.querySelector('[data-sheet-grabber]')).not.toBeNull();
  });

  it('does not render a grabber for non-bottom sides', () => {
    render(Modal, { props: { open: true, side: 'center', children: text('x') } });
    expect(document.querySelector('[data-sheet-grabber]')).toBeNull();
  });

  function mockMatchMedia(matches: boolean) {
    const original = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })) as typeof window.matchMedia;
    return () => {
      window.matchMedia = original;
    };
  }

  it('resolves side="auto" to bottom when (min-width: 768px) does not match', () => {
    const restore = mockMatchMedia(false);
    try {
      render(Modal, { props: { open: true, side: 'auto', children: text('x') } });
      expect(document.querySelector('[data-sheet-grabber]')).not.toBeNull();
    } finally {
      restore();
    }
  });

  it('resolves side="auto" to center when (min-width: 768px) matches', () => {
    const restore = mockMatchMedia(true);
    try {
      render(Modal, { props: { open: true, side: 'auto', children: text('x') } });
      // No grabber at desktop sizes — the center variant renders instead.
      expect(document.querySelector('[data-sheet-grabber]')).toBeNull();
    } finally {
      restore();
    }
  });

  it('renders with role=dialog', () => {
    render(Modal, { props: { open: true, children: text('x') } });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('renders the title when provided', () => {
    render(Modal, { props: { open: true, title: 'Bonjour', children: text('x') } });
    expect(screen.getByText('Bonjour')).toBeTruthy();
  });

  it('renders the description when provided', () => {
    render(Modal, { props: { open: true, description: 'Sous-titre', children: text('x') } });
    expect(screen.getByText('Sous-titre')).toBeTruthy();
  });

  it('renders footer snippet when provided', () => {
    render(Modal, {
      props: { open: true, children: text('body'), footer: text('actions') }
    });
    expect(screen.getByText('actions')).toBeTruthy();
  });

  it('does NOT wrap children in a scroll container by default', () => {
    // Default Modal (no `scrollableBody`) should keep the body un-wrapped so
    // short content (confirm dialogs, info modals) doesn't get an unnecessary
    // 70vh cap.
    render(Modal, { props: { open: true, children: text('plain body') } });
    const wrapper = document.querySelector('[role="dialog"] .max-h-\\[70vh\\].overflow-y-auto');
    expect(wrapper).toBeNull();
  });

  it('wraps children in a max-h-[70vh] overflow-y-auto container when scrollableBody is true', () => {
    // The wrapper is what lets the inner content scroll instead of clipping
    // when the body grows taller than the 92dvh bottom-sheet cap. Modal's
    // pointer handler routes inner-scroll vs drag-to-dismiss via the
    // `findScrollable` walk; this wrapper is what makes that walk succeed
    // for AllergenInfoDialog / StageDetailSheet.
    render(Modal, {
      props: { open: true, side: 'auto', scrollableBody: true, children: text('long body') }
    });
    const wrapper = document.querySelector('[role="dialog"] .max-h-\\[70vh\\].overflow-y-auto');
    expect(wrapper).not.toBeNull();
    // Children land inside the wrapper, not as a sibling.
    expect(wrapper?.textContent).toContain('long body');
  });

  function getSheetTargets() {
    const sheet = screen.getByRole('dialog') as HTMLElement;
    const grabber = document.querySelector('[data-sheet-grabber]') as HTMLElement;
    // happy-dom does not implement setPointerCapture; stub it.
    (sheet as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture = () => {};
    return { sheet, grabber };
  }

  async function dragSheet(deltaY: number, holdMs = 250, fromTarget?: HTMLElement) {
    const { sheet, grabber } = getSheetTargets();
    const target = fromTarget ?? grabber;
    const fire = (type: string, clientY: number) =>
      target.dispatchEvent(
        new PointerEvent(type, { clientY, pointerType: 'touch', button: 0, bubbles: true })
      );
    fire('pointerdown', 0);
    fire('pointermove', deltaY);
    await new Promise((r) => setTimeout(r, holdMs));
    fire('pointerup', deltaY);
    return { sheet };
  }

  it('closes a bottom sheet when dragged past the threshold from the header', async () => {
    let lastOpen: boolean | undefined;
    render(Modal, {
      props: {
        open: true,
        side: 'bottom',
        onOpenChange: (v) => {
          lastOpen = v;
        },
        children: text('x')
      }
    });
    await dragSheet(200);
    expect(lastOpen).toBe(false);
  });

  it('keeps a bottom sheet open when released below the threshold', async () => {
    let lastOpen: boolean | undefined;
    render(Modal, {
      props: {
        open: true,
        side: 'bottom',
        onOpenChange: (v) => {
          lastOpen = v;
        },
        children: text('x')
      }
    });
    await dragSheet(40);
    expect(lastOpen).toBeUndefined();
  });

  it('does not close a bottom sheet on a bare tap (no drag) of the header', async () => {
    let lastOpen: boolean | undefined;
    render(Modal, {
      props: {
        open: true,
        side: 'bottom',
        onOpenChange: (v) => {
          lastOpen = v;
        },
        children: text('x')
      }
    });
    await dragSheet(0);
    expect(lastOpen).toBeUndefined();
  });

  it('does not dismiss when the drag is cancelled past the threshold (system interrupt)', () => {
    let lastOpen: boolean | undefined;
    render(Modal, {
      props: {
        open: true,
        side: 'bottom',
        onOpenChange: (v) => {
          lastOpen = v;
        },
        children: text('x')
      }
    });

    const { grabber } = getSheetTargets();
    const fire = (type: string, clientY: number) =>
      grabber.dispatchEvent(
        new PointerEvent(type, { clientY, pointerType: 'touch', button: 0, bubbles: true })
      );

    fire('pointerdown', 0);
    fire('pointermove', 200);
    fire('pointercancel', 200);

    expect(lastOpen).toBeUndefined();
  });

  it('scrolls the inner content downward when the press starts at scrollTop=0 and moves up', async () => {
    let lastOpen: boolean | undefined;
    const scrollSnippet = createRawSnippet(() => ({
      render: () =>
        `<div data-testid="scroll-area-top" style="overflow-y: auto; max-height: 100px;"><div style="height: 400px;">tall</div></div>`
    }));
    render(Modal, {
      props: {
        open: true,
        side: 'bottom',
        onOpenChange: (v) => {
          lastOpen = v;
        },
        children: scrollSnippet
      }
    });
    const area = document.querySelector('[data-testid="scroll-area-top"]') as HTMLElement;
    let scrollTop = 0;
    Object.defineProperty(area, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = Math.max(0, Math.min(300, v));
      }
    });
    Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 400 });
    Object.defineProperty(area, 'clientHeight', { configurable: true, value: 100 });

    const fire = (type: string, clientY: number) =>
      area.dispatchEvent(
        new PointerEvent(type, { clientY, pointerType: 'touch', button: 0, bubbles: true })
      );
    fire('pointerdown', 100);
    fire('pointermove', 60); // finger moved up 40px → scroll DOWN 40px
    await new Promise((r) => setTimeout(r, 250));
    fire('pointerup', 60);

    expect(scrollTop).toBe(40);
    expect(lastOpen).toBeUndefined();
  });

  it('scrolls the inner content (does not dismiss) when the press starts on a scrolled-down area', async () => {
    let lastOpen: boolean | undefined;
    const scrollSnippet = createRawSnippet(() => ({
      render: () =>
        `<div data-testid="scroll-area" style="overflow-y: auto; max-height: 100px;"><div style="height: 400px;">tall</div></div>`
    }));
    render(Modal, {
      props: {
        open: true,
        side: 'bottom',
        onOpenChange: (v) => {
          lastOpen = v;
        },
        children: scrollSnippet
      }
    });
    const area = document.querySelector('[data-testid="scroll-area"]') as HTMLElement;
    // happy-dom doesn't truly scroll. Back scrollTop with a getter/setter so
    // the component's manual-scroll code can both read and write it.
    let scrollTop = 50;
    Object.defineProperty(area, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (v: number) => {
        scrollTop = Math.max(0, v);
      }
    });
    Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 400 });
    Object.defineProperty(area, 'clientHeight', { configurable: true, value: 100 });

    const fire = (type: string, clientY: number) =>
      area.dispatchEvent(
        new PointerEvent(type, { clientY, pointerType: 'touch', button: 0, bubbles: true })
      );
    fire('pointerdown', 0);
    fire('pointermove', 30);
    await new Promise((r) => setTimeout(r, 250));
    fire('pointerup', 30);

    // Dragging the finger down 30px should pull scrollTop down by 30 (from 50 to 20).
    expect(scrollTop).toBe(20);
    // The sheet itself should not have dismissed.
    expect(lastOpen).toBeUndefined();
  });

  it('lets a tap on an interactive child element pass through without dragging', async () => {
    let lastOpen: boolean | undefined;
    const buttonSnippet = createRawSnippet(() => ({
      render: () => `<button type="button" data-testid="inner-btn">Tap me</button>`
    }));
    render(Modal, {
      props: {
        open: true,
        side: 'bottom',
        onOpenChange: (v) => {
          lastOpen = v;
        },
        children: buttonSnippet
      }
    });
    const button = document.querySelector('[data-testid="inner-btn"]') as HTMLElement;
    // Even a deliberate downward gesture starting on the button should not
    // hijack the click into a dismiss.
    button.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientY: 0,
        pointerType: 'touch',
        button: 0,
        bubbles: true
      })
    );
    button.dispatchEvent(
      new PointerEvent('pointermove', {
        clientY: 200,
        pointerType: 'touch',
        button: 0,
        bubbles: true
      })
    );
    button.dispatchEvent(
      new PointerEvent('pointerup', {
        clientY: 200,
        pointerType: 'touch',
        button: 0,
        bubbles: true
      })
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(lastOpen).toBeUndefined();
  });
});
