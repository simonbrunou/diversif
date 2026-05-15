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

  it('defers to native scroll when the press starts on a scrolled-down area', async () => {
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
    // Force the scrollable into a non-top scroll position. happy-dom doesn't
    // truly scroll, so we fake the scrollTop getter for the duration of the
    // gesture.
    Object.defineProperty(area, 'scrollTop', { configurable: true, value: 50 });
    Object.defineProperty(area, 'scrollHeight', { configurable: true, value: 400 });
    Object.defineProperty(area, 'clientHeight', { configurable: true, value: 100 });

    const fire = (type: string, clientY: number) =>
      area.dispatchEvent(
        new PointerEvent(type, { clientY, pointerType: 'touch', button: 0, bubbles: true })
      );
    fire('pointerdown', 0);
    fire('pointermove', 200);
    await new Promise((r) => setTimeout(r, 250));
    fire('pointerup', 200);

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
