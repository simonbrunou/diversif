// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import Callout from './Callout.svelte';

afterEach(() => cleanup());

describe('Callout', () => {
  it('renders as an aside with role="note" by default', () => {
    const { container } = render(Callout, {
      props: { variant: 'warning', children: textSnippet('Heads up.') }
    });
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside?.getAttribute('role')).toBe('note');
    expect(aside?.textContent).toContain('Heads up.');
  });

  it('renders the warning surface for variant="warning"', () => {
    const { container } = render(Callout, {
      props: { variant: 'warning', children: textSnippet('warning body') }
    });
    expect(container.querySelector('aside')?.className).toContain('bg-warning');
    expect(container.querySelector('svg')).not.toBeNull(); // AlertTriangle icon
  });

  it('renders the info surface for variant="info"', () => {
    const { container } = render(Callout, {
      props: { variant: 'info', children: textSnippet('info body') }
    });
    expect(container.querySelector('aside')?.className).toContain('bg-tile-sky');
  });

  it('renders the success surface for variant="success"', () => {
    const { container } = render(Callout, {
      props: { variant: 'success', children: textSnippet('done') }
    });
    expect(container.querySelector('aside')?.className).toContain('bg-tile-mint');
  });

  it('renders an optional title above the body', () => {
    render(Callout, {
      props: { variant: 'info', title: 'Bon à savoir', children: textSnippet('Body.') }
    });
    const heading = screen.getByText('Bon à savoir');
    expect(heading.tagName.toLowerCase()).toBe('p');
    expect(heading.className).toContain('font-semibold');
  });

  it('forwards a custom class', () => {
    const { container } = render(Callout, {
      props: { variant: 'warning', class: 'mt-4', children: textSnippet('x') }
    });
    expect(container.querySelector('aside')?.className).toContain('mt-4');
  });
});
