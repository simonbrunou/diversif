// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import '../../test/app-stubs';
import '../../test/component';
import ThemeToggle from './ThemeToggle.svelte';

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Browser-mode test — provide localStorage + matchMedia stubs.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k)
    });
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders 3 toggle buttons', () => {
    const { container } = render(ThemeToggle, { props: {} });
    expect(container.querySelectorAll('button').length).toBe(3);
  });

  it('marks the system option pressed by default', () => {
    const { container } = render(ThemeToggle, { props: {} });
    const buttons = Array.from(container.querySelectorAll('button'));
    const sys = buttons.find((b) => b.textContent?.trim() === 'Système');
    expect(sys?.getAttribute('aria-pressed')).toBe('true');
  });

  it('switches to dark when the dark button is clicked', async () => {
    const { container } = render(ThemeToggle, { props: {} });
    const buttons = Array.from(container.querySelectorAll('button'));
    const dark = buttons.find((b) => b.textContent?.trim() === 'Sombre')!;
    await fireEvent.click(dark);
    expect(dark.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('switches to light when the light button is clicked', async () => {
    const { container } = render(ThemeToggle, { props: {} });
    const buttons = Array.from(container.querySelectorAll('button'));
    const light = buttons.find((b) => b.textContent?.trim() === 'Clair')!;
    await fireEvent.click(light);
    expect(light.getAttribute('aria-pressed')).toBe('true');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('clears the stored preference when system is selected', async () => {
    const { container } = render(ThemeToggle, { props: {} });
    const buttons = Array.from(container.querySelectorAll('button'));
    await fireEvent.click(buttons.find((b) => b.textContent?.trim() === 'Sombre')!);
    expect(localStorage.getItem('theme')).toBe('dark');
    await fireEvent.click(buttons.find((b) => b.textContent?.trim() === 'Système')!);
    expect(localStorage.getItem('theme')).toBeNull();
  });
});
