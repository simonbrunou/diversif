// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../../test/component';
import { textSnippet } from '../../../test/component';
import Card from './Card.svelte';

describe('Card', () => {
  it('renders children inside a div', () => {
    const { container } = render(Card, { props: { children: textSnippet('Hello') } });
    expect(container.textContent).toContain('Hello');
    expect(container.querySelector('div')).not.toBeNull();
  });

  it('appends additional classes via class prop', () => {
    const { container } = render(Card, {
      props: { class: 'extra', children: textSnippet('X') }
    });
    expect(container.querySelector('div')?.className).toContain('extra');
  });

  it('renders without children', () => {
    const { container } = render(Card, { props: {} });
    expect(container.querySelector('div')).not.toBeNull();
  });

  it('uses default variant when not specified', () => {
    const { container } = render(Card, { props: { children: textSnippet('X') } });
    expect(container.querySelector('div')?.className).toContain('bg-card');
  });

  it.each(['tile-peach', 'tile-mint', 'tile-butter', 'tile-sky', 'tile-lilac'] as const)(
    'applies the %s variant',
    (variant) => {
      const { container } = render(Card, {
        props: { variant, children: textSnippet('X') }
      });
      expect(container.querySelector('div')?.className).toContain(`bg-${variant}`);
    }
  );

  it('applies the surface variant', () => {
    const { container } = render(Card, {
      props: { variant: 'surface', children: textSnippet('X') }
    });
    expect(container.querySelector('div')?.className).toContain('bg-surface');
    expect(container.querySelector('div')?.className).toContain('shadow-soft');
  });

  it('renders as <section> when as="section"', () => {
    const { container } = render(Card, {
      props: { as: 'section', children: textSnippet('X') }
    });
    expect(container.querySelector('section')).not.toBeNull();
    expect(container.querySelector('div')).toBeNull();
  });

  it('renders as <article> when as="article"', () => {
    const { container } = render(Card, {
      props: { as: 'article', children: textSnippet('X') }
    });
    expect(container.querySelector('article')).not.toBeNull();
  });

  it('forwards aria-label to the rendered element', () => {
    const { container } = render(Card, {
      props: { as: 'section', 'aria-label': 'Stats', children: textSnippet('X') }
    });
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('Stats');
  });
});
