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

  async function dragGrabber(deltaY: number, holdMs = 250) {
    const grabber = document.querySelector('[data-sheet-grabber]')?.parentElement as HTMLElement;
    // happy-dom does not implement setPointerCapture; stub it.
    (grabber as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture =
      () => {};
    const fire = (type: string, clientY: number) =>
      grabber.dispatchEvent(
        new PointerEvent(type, { clientY, pointerType: 'touch', button: 0, bubbles: true })
      );
    fire('pointerdown', 0);
    fire('pointermove', deltaY);
    await new Promise((r) => setTimeout(r, holdMs));
    fire('pointerup', deltaY);
  }

  it('closes a bottom sheet when the grabber is dragged past the threshold', async () => {
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
    await dragGrabber(200);
    expect(lastOpen).toBe(false);
  });

  it('keeps a bottom sheet open when the grabber is released below the threshold', async () => {
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
    await dragGrabber(40);
    expect(lastOpen).toBeUndefined();
  });
});
