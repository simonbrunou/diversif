import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import CarnetAllergens from './CarnetAllergens.svelte';
import { expectPairedForeground } from '../../../test/paired-foreground';

afterEach(() => cleanup());

describe('CarnetAllergens', () => {
  const items = [
    {
      id: 'oeuf',
      label: 'Œuf',
      triedCount: 2,
      lastTried: '2026-04-01',
      daysSinceLastTried: null,
      state: 'cleared' as const
    },
    {
      id: 'arachide',
      label: 'Arachide',
      triedCount: 0,
      lastTried: null,
      daysSinceLastTried: null,
      state: 'todo' as const
    },
    {
      id: 'lait',
      label: 'Lait',
      triedCount: 1,
      lastTried: '2026-04-15',
      daysSinceLastTried: null,
      state: 'reaction' as const
    }
  ];

  it('renders one card per allergen', () => {
    render(CarnetAllergens, { props: { items } });
    expect(screen.getByText('Œuf')).toBeTruthy();
    expect(screen.getByText('Arachide')).toBeTruthy();
    expect(screen.getByText('Lait')).toBeTruthy();
  });

  it('renders empty placeholder when items is empty', () => {
    render(CarnetAllergens, { props: { items: [] } });
    expect(screen.getByText(/Aucun allergène/)).toBeTruthy();
  });

  it('shows a log CTA in the empty state when childId is provided', () => {
    render(CarnetAllergens, { props: { items: [], childId: '7' } });
    const cta = screen.getByRole('link');
    expect(cta.getAttribute('href')).toContain('/child/7/log');
  });

  it('renders the state per card', () => {
    render(CarnetAllergens, { props: { items } });
    expect(screen.getAllByText(/non noté/).length).toBeGreaterThan(0);
  });

  it("renders the 'fading' state with à reproposer pill and days caption", () => {
    const fading = [
      {
        id: 'oeuf',
        label: 'Œuf',
        triedCount: 1,
        lastTried: '2026-04-30',
        daysSinceLastTried: 8,
        state: 'fading' as const
      }
    ];
    render(CarnetAllergens, { props: { items: fading } });
    expect(screen.getByText('Œuf')).toBeTruthy();
    expect(screen.getByText(/à reproposer/i)).toBeTruthy();
    // Caption substitutes the date with the days-since suffix.
    expect(screen.getByText(/8 j/)).toBeTruthy();
  });

  const row = (id: string, state: 'cleared' | 'todo' | 'inconfort' | 'reaction' | 'fading') => ({
    id,
    label: id,
    triedCount: 1,
    lastTried: '2026-04-15',
    daysSinceLastTried: state === 'fading' ? 8 : null,
    state
  });

  it.each([
    ['reaction', 'bg-reaction-reaction/20'],
    ['inconfort', 'bg-reaction-inconfort/10'],
    ['fading', 'bg-tile-peach/20']
  ] as const)(
    "sets the %s row, label and caption, in its tint's own foreground (#649)",
    (state, tint) => {
      render(CarnetAllergens, { props: { items: [row('Sésame', state)] } });
      const li = screen.getByText('Sésame').closest('li');
      expect(li?.classList.contains(tint)).toBe(true);
      if (!li) throw new Error('no row around the label');
      expectPairedForeground(li);
    }
  );

  it.each(['cleared', 'todo'] as const)(
    'keeps the grey caption on a %s row, which sits on the canvas',
    (state) => {
      render(CarnetAllergens, { props: { items: [row('Sésame', state)] } });
      const caption = screen.getByText(/^1× ·/);
      expect(caption.closest('li')?.classList.contains('bg-canvas')).toBe(true);
      expect(caption.classList.contains('text-ink-soft')).toBe(true);
    }
  );
});
