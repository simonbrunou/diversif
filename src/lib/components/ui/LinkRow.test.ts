// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import LinkRow from './LinkRow.svelte';

afterEach(() => cleanup());

describe('LinkRow', () => {
  it('renders an anchor pointing at the given href', () => {
    const { container } = render(LinkRow, {
      props: { href: '/foo', children: textSnippet('Open') }
    });
    const anchor = container.querySelector('a');
    expect(anchor?.getAttribute('href')).toBe('/foo');
    expect(anchor?.textContent?.trim()).toBe('Open');
  });

  it('applies the surface variant by default', () => {
    const { container } = render(LinkRow, {
      props: { href: '/x', children: textSnippet('X') }
    });
    expect(container.querySelector('a')?.className).toContain('bg-surface');
  });

  it.each(['tile-peach', 'tile-mint', 'tile-butter', 'tile-sky', 'tile-lilac'] as const)(
    'applies the %s variant',
    (variant) => {
      const { container } = render(LinkRow, {
        props: { href: '/x', variant, children: textSnippet('X') }
      });
      expect(container.querySelector('a')?.className).toContain(`bg-${variant}`);
    }
  );

  it('adds hover-scale when lift is true', () => {
    const { container } = render(LinkRow, {
      props: { href: '/x', lift: true, children: textSnippet('X') }
    });
    expect(container.querySelector('a')?.className).toContain('hover:scale-[1.01]');
  });

  it('forwards aria-label', () => {
    const { container } = render(LinkRow, {
      props: { href: '/x', 'aria-label': 'Open settings', children: textSnippet('X') }
    });
    expect(container.querySelector('a')?.getAttribute('aria-label')).toBe('Open settings');
  });
});
