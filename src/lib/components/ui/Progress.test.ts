// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import Progress from './Progress.svelte';

afterEach(() => cleanup());

describe('Progress', () => {
  it('renders with role=progressbar and value', () => {
    render(Progress, { props: { value: 47, max: 100 } });
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('47');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });
});
