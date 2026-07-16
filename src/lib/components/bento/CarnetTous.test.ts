import { afterEach, describe, expect, it } from 'bun:test';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import CarnetTous from './CarnetTous.svelte';

afterEach(() => cleanup());

describe('CarnetTous', () => {
  const foods = [
    { id: 1, name: 'Poire', category: 'fruits', tried: 3, status: 'ras' as const },
    { id: 2, name: 'Carotte', category: 'legumes', tried: 1, status: 'ras' as const },
    { id: 3, name: 'Œuf', category: 'oeufs', tried: 0, status: 'todo' as const }
  ];

  it('renders all foods by default', () => {
    render(CarnetTous, { props: { foods } });
    expect(screen.getByText('Poire')).toBeTruthy();
    expect(screen.getByText('Carotte')).toBeTruthy();
    expect(screen.getByText('Œuf')).toBeTruthy();
  });

  it('filters by category when a category pill is clicked', async () => {
    render(CarnetTous, { props: { foods } });
    await fireEvent.click(screen.getByRole('button', { name: 'Fruits' }));
    expect(screen.getByText('Poire')).toBeTruthy();
    expect(screen.queryByText('Carotte')).toBeNull();
    expect(screen.queryByText('Œuf')).toBeNull();
  });

  it('restores all foods when the Tout pill is clicked', async () => {
    render(CarnetTous, { props: { foods } });
    await fireEvent.click(screen.getByRole('button', { name: 'Fruits' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Tout' }));
    expect(screen.getByText('Carotte')).toBeTruthy();
  });

  it('renders the empty placeholder when foods is empty', () => {
    render(CarnetTous, { props: { foods: [] } });
    expect(screen.getByText('Aucun aliment ici')).toBeTruthy();
  });

  it('renders the empty-state CTA with a high-contrast variant, not bg-primary', () => {
    // bg-primary/text-primary-foreground sits right at the 4.5:1 AA floor;
    // axe caught it dipping under threshold on this button (a11y-axe.spec.ts).
    // tile-mint has ~7.2:1 headroom — assert the fix stays in place.
    render(CarnetTous, { props: { foods: [], childId: '1' } });
    const cta = screen.getByRole('link', { name: 'Ajouter un repas' });
    expect(cta.className).toContain('bg-tile-mint');
    expect(cta.className).not.toContain('bg-primary');
  });
});
