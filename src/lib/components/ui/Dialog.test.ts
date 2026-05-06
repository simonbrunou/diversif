// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import '../../../test/component';
import { textSnippet } from '../../../test/component';
import Dialog from './Dialog.svelte';

describe('Dialog', () => {
  it('does not render when closed', () => {
    const { container } = render(Dialog, { props: { open: false } });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders title, description, body, and footer when open', () => {
    render(Dialog, {
      props: {
        open: true,
        title: 'Confirm',
        description: 'Are you sure?',
        children: textSnippet('Body'),
        footer: textSnippet('Footer')
      }
    });
    const dialog = screen.getByRole('dialog');
    // APG: link the dialog to its visible heading via aria-labelledby rather
    // than duplicating the title via aria-label.
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(dialog.getAttribute('aria-label')).toBeNull();
    const heading = screen.getByText('Confirm');
    expect(heading.id).toBe(labelledBy);
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByText('Footer')).toBeTruthy();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
  });

  it('falls back to a generic aria-label when no title is given', () => {
    render(Dialog, {
      props: {
        open: true,
        children: textSnippet('Body')
      }
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBeNull();
    expect(dialog.getAttribute('aria-label')).toBe('Dialogue');
  });

  it('closes on backdrop click and fires onclose', async () => {
    const onclose = vi.fn();
    render(Dialog, {
      props: { open: true, title: 'X', onclose }
    });
    const backdrop = screen.getByRole('dialog');
    await fireEvent.mouseDown(backdrop);
    expect(onclose).toHaveBeenCalled();
  });

  it('closes on Escape key', async () => {
    const onclose = vi.fn();
    render(Dialog, { props: { open: true, title: 'X', onclose } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onclose).toHaveBeenCalled();
  });

  it('ignores other key presses', async () => {
    const onclose = vi.fn();
    render(Dialog, { props: { open: true, title: 'X', onclose } });
    await fireEvent.keyDown(window, { key: 'Enter' });
    expect(onclose).not.toHaveBeenCalled();
  });

  it('does not call onclose when clicking inner content', async () => {
    const onclose = vi.fn();
    render(Dialog, {
      props: { open: true, title: 'X', children: textSnippet('Body'), onclose }
    });
    const body = screen.getByText('Body');
    await fireEvent.mouseDown(body);
    expect(onclose).not.toHaveBeenCalled();
  });

  it('moves focus into the panel on open', async () => {
    // Place a focusable element outside the dialog so we can verify focus moves.
    const trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    render(Dialog, {
      props: {
        open: true,
        title: 'X',
        footer: textSnippet('Close')
      }
    });
    // Wait for the queueMicrotask in the focus effect.
    await new Promise((r) => setTimeout(r, 0));
    expect(document.activeElement).not.toBe(trigger);
    expect(document.activeElement?.tagName).not.toBe('BODY');
    trigger.remove();
  });
});
