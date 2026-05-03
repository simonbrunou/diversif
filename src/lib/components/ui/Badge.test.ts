// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../../test/component';
import { textSnippet } from '../../../test/component';
import Badge from './Badge.svelte';

describe('Badge', () => {
  it('renders the children', () => {
    const { container } = render(Badge, { props: { children: textSnippet('Hello') } });
    expect(container.textContent).toContain('Hello');
  });

  it('applies the default variant', () => {
    const { container } = render(Badge, { props: { children: textSnippet('X') } });
    const span = container.querySelector('span');
    expect(span?.className).toMatch(/bg-primary/);
  });

  it.each(['secondary', 'outline', 'ras', 'inconfort', 'reaction'] as const)(
    'applies variant %s',
    (variant) => {
      const { container } = render(Badge, {
        props: { variant, children: textSnippet('X') }
      });
      const span = container.querySelector('span');
      expect(span?.className.length).toBeGreaterThan(0);
    }
  );

  it('appends additional classes via class prop', () => {
    const { container } = render(Badge, {
      props: { class: 'extra-class', children: textSnippet('X') }
    });
    expect(container.querySelector('span')?.className).toContain('extra-class');
  });
});
