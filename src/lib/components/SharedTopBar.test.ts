// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import '../../test/component';
import SharedTopBar from './SharedTopBar.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('SharedTopBar', () => {
  it('renders the brand link', () => {
    render(SharedTopBar);
    const brand = screen.getByRole('link', { name: /Diversif/i });
    expect(brand).toBeTruthy();
    expect(brand.getAttribute('href')).toBe('/');
  });

  it('renders the right-side children slot', () => {
    render(SharedTopBar, { props: { children: text('right-content') } });
    expect(screen.getByText('right-content')).toBeTruthy();
  });

  it('renders the below snippet inside the header', () => {
    const { container } = render(SharedTopBar, {
      props: { below: text('below-content') }
    });
    const header = container.querySelector('header');
    expect(header?.textContent).toContain('below-content');
  });

  it('applies the class prop to the outer header', () => {
    const { container } = render(SharedTopBar, { props: { class: 'lg:hidden' } });
    expect(container.querySelector('header')?.className).toContain('lg:hidden');
  });
});
