// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import Switch from './Switch.svelte';

afterEach(() => cleanup());

describe('Switch', () => {
  it('renders with role=switch', () => {
    render(Switch, { props: { checked: false } });
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('reflects checked state', () => {
    render(Switch, { props: { checked: true } });
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('fires onCheckedChange', async () => {
    const onCheckedChange = vi.fn();
    render(Switch, { props: { checked: false, onCheckedChange } });
    await fireEvent.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalled();
  });
});
