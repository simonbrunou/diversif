import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import FoodCardGrid from './FoodCardGrid.svelte';

afterEach(() => cleanup());

describe('FoodCardGrid', () => {
  const items = [
    { id: 1, name: 'Poire', category: 'fruits', tried: 2, status: 'ras' as const },
    { id: 2, name: 'Banane', category: 'fruits', tried: 0, status: 'todo' as const }
  ];

  it('renders one card per item', () => {
    render(FoodCardGrid, { props: { items } });
    expect(screen.getByText('Poire')).toBeTruthy();
    expect(screen.getByText('Banane')).toBeTruthy();
  });
});
