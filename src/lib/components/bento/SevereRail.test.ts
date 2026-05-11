// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import SevereRail from './SevereRail.svelte';

afterEach(() => cleanup());

describe('SevereRail', () => {
  it('renders the severe rail body', () => {
    render(SevereRail, {});
    expect(screen.getByText(/Difficulté à respirer/)).toBeTruthy();
  });

  it('uses role="alert" so screen readers announce it', () => {
    const { container } = render(SevereRail, {});
    const alert = container.querySelector('[role="alert"]');
    expect(alert).toBeTruthy();
  });

  it('wraps the rail in a tel:15 link', () => {
    const { container } = render(SevereRail, {});
    const link = container.querySelector('a[href="tel:15"]');
    expect(link).toBeTruthy();
  });
});
