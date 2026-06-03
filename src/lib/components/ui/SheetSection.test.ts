import { afterEach, describe, expect, it } from 'bun:test';
import { render, cleanup, screen } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import { Calendar } from 'lucide-svelte';
import SheetSection from './SheetSection.svelte';

afterEach(() => cleanup());

describe('SheetSection', () => {
  it('renders the title as an h2 with the section-label classes', () => {
    render(SheetSection, {
      props: { title: 'Quand introduire', children: textSnippet('body') }
    });
    const h = screen.getByText('Quand introduire');
    expect(h.tagName.toLowerCase()).toBe('h2');
    expect(h.className).toContain('uppercase');
    expect(h.className).toContain('text-ink-soft');
  });

  it('renders the icon next to the title when provided', () => {
    const { container } = render(SheetSection, {
      props: { title: 'X', icon: Calendar, children: textSnippet('Y') }
    });
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders the children below the title', () => {
    const { container } = render(SheetSection, {
      props: { title: 'X', children: textSnippet('Body content') }
    });
    expect(container.textContent).toContain('Body content');
  });

  it('forwards a custom class onto the section element', () => {
    const { container } = render(SheetSection, {
      props: { title: 'X', class: 'mt-6', children: textSnippet('Y') }
    });
    expect(container.querySelector('section')?.className).toContain('mt-6');
  });
});
