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
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Confirm');
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByText('Footer')).toBeTruthy();
    expect(screen.getByText('Are you sure?')).toBeTruthy();
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
});
