// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import { Sparkles } from 'lucide-svelte';
import EmptyHint from './EmptyHint.svelte';

afterEach(() => cleanup());

describe('EmptyHint', () => {
  it('renders a dashed paragraph with the message', () => {
    const { container } = render(EmptyHint, {
      props: { children: textSnippet('Rien à signaler.') }
    });
    const p = container.querySelector('p');
    expect(p?.textContent?.trim()).toBe('Rien à signaler.');
    expect(p?.className).toContain('border-dashed');
    expect(p?.className).toContain('text-ink-soft');
  });

  it('appends additional classes via class prop', () => {
    const { container } = render(EmptyHint, {
      props: { class: 'mb-2', children: textSnippet('X') }
    });
    expect(container.querySelector('p')?.className).toContain('mb-2');
  });

  it('switches to the rich layout when a title is provided', () => {
    const { container } = render(EmptyHint, {
      props: {
        title: 'Vous avez fait le tour du catalogue',
        children: textSnippet('Variez les préparations.')
      }
    });
    expect(screen.getByText('Vous avez fait le tour du catalogue').tagName.toLowerCase()).toBe(
      'h2'
    );
    // Rich layout wraps the body in <div><p>; plain layout would render <p> directly.
    expect(container.querySelector('div.rounded-tile')).toBeTruthy();
    expect(container.querySelector('h2')?.nextElementSibling?.tagName.toLowerCase()).toBe('p');
  });

  it('renders the icon in the rich layout', () => {
    const { container } = render(EmptyHint, {
      props: {
        title: 'Catalog clear',
        icon: Sparkles,
        children: textSnippet('Body.')
      }
    });
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
