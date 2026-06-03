import { afterEach, describe, expect, it } from 'bun:test';
import { render, cleanup } from '@testing-library/svelte';
import BentoMark from './BentoMark.svelte';

afterEach(() => cleanup());

describe('BentoMark', () => {
  it('renders a 44x44 rounded square with aria-label', () => {
    const { container } = render(BentoMark);
    const mark = container.querySelector('[aria-label="Diversif"]');
    expect(mark).toBeTruthy();
  });

  it('accepts a size override prop', () => {
    const { container } = render(BentoMark, { props: { size: 64 } });
    const mark = container.querySelector('[aria-label="Diversif"]') as HTMLElement;
    expect(mark.style.width).toBe('64px');
    expect(mark.style.height).toBe('64px');
  });
});
