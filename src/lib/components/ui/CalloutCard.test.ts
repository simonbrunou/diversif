// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import { createRawSnippet, type Snippet } from 'svelte';
import { textSnippet } from '../../../test/component';
import { Sparkles } from 'lucide-svelte';
import CalloutCard from './CalloutCard.svelte';

afterEach(() => cleanup());

const actionSnippet = (label: string): Snippet =>
  createRawSnippet(() => ({
    render: () => `<a href="#">${label}</a>`
  })) as unknown as Snippet;

describe('CalloutCard', () => {
  it('renders title as h2, body, and dashed border', () => {
    const { container } = render(CalloutCard, {
      props: { title: 'Vous avez fait le tour', children: textSnippet('Variez.') }
    });
    expect(screen.getByText('Vous avez fait le tour').tagName.toLowerCase()).toBe('h2');
    expect(container.querySelector('div.rounded-tile')?.className).toContain('border-dashed');
    expect(container.textContent).toContain('Variez.');
  });

  it('renders the icon when provided', () => {
    const { container } = render(CalloutCard, {
      props: { title: 'X', icon: Sparkles, children: textSnippet('Y') }
    });
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders the action snippet below the body', () => {
    const { container } = render(CalloutCard, {
      props: {
        title: 'X',
        children: textSnippet('Y'),
        action: actionSnippet('Voir')
      }
    });
    expect(container.querySelector('a')?.textContent).toBe('Voir');
  });

  it('renders without an icon or action', () => {
    const { container } = render(CalloutCard, {
      props: { title: 'X', children: textSnippet('Y') }
    });
    expect(container.querySelector('svg')).toBeNull();
  });

  it('forwards a custom class', () => {
    const { container } = render(CalloutCard, {
      props: { title: 'X', class: 'mt-8', children: textSnippet('Y') }
    });
    expect(container.querySelector('div')?.className).toContain('mt-8');
  });
});
