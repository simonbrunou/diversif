import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import QuantitiesCard from './QuantitiesCard.svelte';
import { QUANTITIES } from '$lib/content/quantities';

afterEach(() => cleanup());

describe('QuantitiesCard', () => {
  it('renders the daily totals for the stage', () => {
    render(QuantitiesCard, { props: { quantities: QUANTITIES['6-9'] } });
    expect(screen.getByText('~500 mL/j')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('omits the egg row for a stage with no egg guidance', () => {
    render(QuantitiesCard, { props: { quantities: QUANTITIES['4-6'] } });
    expect(screen.queryByText('Œuf')).toBeNull();
  });
});
