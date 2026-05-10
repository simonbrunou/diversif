// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Sheet from './Sheet.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(Sheet, { props: { open: false, children: text('content') } });
    expect(screen.queryByText('content')).toBeNull();
  });

  it('renders children when open', () => {
    render(Sheet, { props: { open: true, children: text('content') } });
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('renders the drag grabber when open', () => {
    render(Sheet, { props: { open: true, children: text('x') } });
    expect(document.querySelector('[data-sheet-grabber]')).not.toBeNull();
  });

  it('renders with role=dialog', () => {
    render(Sheet, { props: { open: true, children: text('x') } });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
