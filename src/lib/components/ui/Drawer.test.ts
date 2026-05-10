// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Drawer from './Drawer.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Drawer', () => {
  it('hides content when closed', () => {
    render(Drawer, { props: { open: false, children: text('panel') } });
    expect(screen.queryByText('panel')).toBeNull();
  });

  it('shows content when open', () => {
    render(Drawer, { props: { open: true, children: text('panel') } });
    expect(screen.getByText('panel')).toBeTruthy();
  });

  it('uses role=dialog', () => {
    render(Drawer, { props: { open: true, children: text('x') } });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
