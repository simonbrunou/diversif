// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Separator from './Separator.svelte';

afterEach(() => cleanup());

describe('Separator', () => {
  it('renders a horizontal separator by default', () => {
    const { container } = render(Separator);
    const sep = container.firstElementChild as HTMLElement;
    expect(sep.getAttribute('aria-orientation') ?? 'horizontal').toBe('horizontal');
  });

  it('renders vertical when orientation=vertical', () => {
    const { container } = render(Separator, { props: { orientation: 'vertical' } });
    const sep = container.firstElementChild as HTMLElement;
    expect(sep.className).toContain('w-px');
  });
});
