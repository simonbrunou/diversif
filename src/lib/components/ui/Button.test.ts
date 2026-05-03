// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Button from './Button.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Button', () => {
  it('renders a button by default', () => {
    render(Button, { props: { children: text('Click me') } });
    const btn = screen.getByRole('button');
    expect(btn.textContent).toContain('Click me');
  });

  it('renders an anchor when href is provided', () => {
    render(Button, { props: { href: '/somewhere', children: text('Go') } });
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/somewhere');
  });

  it('calls onclick when clicked', async () => {
    const onclick = vi.fn();
    render(Button, { props: { onclick, children: text('Tap') } });
    await fireEvent.click(screen.getByRole('button'));
    expect(onclick).toHaveBeenCalled();
  });

  it('is disabled when disabled prop is true', () => {
    render(Button, { props: { disabled: true, children: text('X') } });
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('is disabled when loading prop is true', async () => {
    render(Button, { props: { loading: true, children: text('X') } });
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('applies the variant class', () => {
    render(Button, { props: { variant: 'destructive', children: text('X') } });
    expect(screen.getByRole('button').className).toContain('destructive');
  });

  it('applies the size class', () => {
    render(Button, { props: { size: 'lg', children: text('X') } });
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('h-12');
  });

  it('renders a button with size=lg with the larger spinner when loading', () => {
    render(Button, { props: { size: 'lg', loading: true, children: text('X') } });
    const btn = screen.getByRole('button');
    expect(btn.querySelector('svg')).not.toBeNull();
  });
});
