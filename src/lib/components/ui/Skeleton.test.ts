// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Skeleton from './Skeleton.svelte';

afterEach(() => cleanup());

describe('Skeleton', () => {
  it('renders with the pulse class', () => {
    const { container } = render(Skeleton);
    expect(container.firstElementChild?.className).toContain('animate-pulse');
  });

  it('respects custom class', () => {
    const { container } = render(Skeleton, { props: { class: 'h-10 w-32' } });
    expect(container.firstElementChild?.className).toContain('h-10');
  });
});
