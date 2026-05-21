// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import SectionHeader from './SectionHeader.svelte';

afterEach(() => cleanup());

describe('SectionHeader', () => {
  it('renders as <h2> by default with the ink-soft tone class', () => {
    const { container } = render(SectionHeader, {
      props: { children: textSnippet('Vos enfants') }
    });
    const heading = container.querySelector('h2');
    expect(heading).not.toBeNull();
    expect(heading?.className).toContain('uppercase');
    expect(heading?.className).toContain('text-ink-soft');
    expect(heading?.textContent?.trim()).toBe('Vos enfants');
  });

  it('renders as <h3> when as="h3"', () => {
    const { container } = render(SectionHeader, {
      props: { as: 'h3', children: textSnippet('Sous-section') }
    });
    expect(container.querySelector('h3')).not.toBeNull();
    expect(container.querySelector('h2')).toBeNull();
  });

  it('applies the destructive tone class', () => {
    const { container } = render(SectionHeader, {
      props: { tone: 'destructive', children: textSnippet('Zone de danger') }
    });
    expect(container.querySelector('h2')?.className).toContain('text-destructive');
  });

  it('forwards a custom class', () => {
    const { container } = render(SectionHeader, {
      props: { class: 'mt-8', children: textSnippet('Section') }
    });
    expect(container.querySelector('h2')?.className).toContain('mt-8');
  });

  it('uses text-sm by default (size="md")', () => {
    const { container } = render(SectionHeader, { props: { children: textSnippet('X') } });
    expect(container.querySelector('h2')?.className).toContain('text-sm');
  });

  it('uses text-xs when size="sm"', () => {
    const { container } = render(SectionHeader, {
      props: { size: 'sm', children: textSnippet('X') }
    });
    expect(container.querySelector('h2')?.className).toContain('text-xs');
    expect(container.querySelector('h2')?.className).not.toContain('text-sm');
  });
});
