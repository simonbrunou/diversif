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
});
