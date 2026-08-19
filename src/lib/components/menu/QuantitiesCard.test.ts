import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import QuantitiesCard from './QuantitiesCard.svelte';
import { QUANTITIES } from '$lib/content/quantities';

afterEach(() => cleanup());

describe('QuantitiesCard', () => {
  it('renders the daily totals for the stage', () => {
    render(QuantitiesCard, { props: { quantities: QUANTITIES['6-9'] } });
    expect(screen.getByText('environ 500 mL/j')).toBeTruthy();
    expect(screen.getByText(/4 repas autour de 8 mois/)).toBeTruthy();
  });

  it('omits the egg row for a stage with no egg guidance', () => {
    render(QuantitiesCard, { props: { quantities: QUANTITIES['4-6'] } });
    expect(screen.queryByText('Œuf')).toBeNull();
  });

  it('surfaces the stage sources as cited references, not silently dropped', () => {
    render(QuantitiesCard, { props: { quantities: QUANTITIES['6-9'] } });
    expect(screen.getByText('Santé publique France / PNNS (2022)')).toBeTruthy();
    expect(screen.getByText('Santé publique France / PNNS (2025)')).toBeTruthy();
    expect(screen.getByText('HCSP (2020)')).toBeTruthy();
  });
});
