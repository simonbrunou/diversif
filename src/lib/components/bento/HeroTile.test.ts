// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import HeroTile from './HeroTile.svelte';

afterEach(() => cleanup());

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
    await fireEvent.click(screen.getByRole('button', { name: /Logger Poire/ }));
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
    await fireEvent.click(screen.getByRole('button', { name: /\+ Logger/ }));
    expect(onLog).toHaveBeenCalledWith(null);
  });
});
