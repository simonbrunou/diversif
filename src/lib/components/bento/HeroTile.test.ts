// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup, waitFor } from '@testing-library/svelte';
import HeroTile from './HeroTile.svelte';

afterEach(() => cleanup());

// HeroTile debounces its CTA for 200ms after each suggestion change to
// swallow stray taps landing on a freshly-rendered tile. Tests that click
// the CTA must wait for the button to become enabled.
async function waitForEnabled(button: HTMLElement) {
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
}

describe('HeroTile', () => {
  const childName = 'Léo';

  it('renders the empty-state welcome copy when no suggestion', () => {
    render(HeroTile, { props: { childName, suggestion: null, onLog: () => {} } });
    expect(screen.getByText(/Bienvenue Léo/)).toBeTruthy();
  });

  it('renders the suggestion title when a food is suggested', () => {
    render(HeroTile, {
      props: {
        childName,
        suggestion: { id: 1, name: 'Poire', category: 'fruits', allergenType: null },
        onLog: () => {}
      }
    });
    expect(screen.getByText(/Et si on goûtait Poire/)).toBeTruthy();
  });

  it('fires onLog with the suggested food when CTA is tapped', async () => {
    const onLog = vi.fn();
    render(HeroTile, {
      props: {
        childName,
        suggestion: { id: 1, name: 'Poire', category: 'fruits', allergenType: null },
        onLog
      }
    });
    const button = screen.getByRole('button', { name: /Enregistrer Poire/ });
    await waitForEnabled(button);
    await fireEvent.click(button);
    expect(onLog).toHaveBeenCalledWith({
      id: 1,
      name: 'Poire',
      category: 'fruits',
      allergenType: null
    });
  });

  it('fires onLog with null in the empty-state CTA', async () => {
    const onLog = vi.fn();
    render(HeroTile, { props: { childName, suggestion: null, onLog } });
    const button = screen.getByRole('button', { name: /\+ Enregistrer/ });
    await waitForEnabled(button);
    await fireEvent.click(button);
    expect(onLog).toHaveBeenCalledWith(null);
  });

  it('disables the CTA briefly after a suggestion change', () => {
    render(HeroTile, {
      props: {
        childName,
        suggestion: { id: 1, name: 'Poire', category: 'fruits', allergenType: null },
        onLog: () => {}
      }
    });
    const button = screen.getByRole('button', { name: /Enregistrer Poire/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
