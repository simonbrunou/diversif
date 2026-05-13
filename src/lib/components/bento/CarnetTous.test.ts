// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
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

  it('restores all foods when the tout pill is clicked', async () => {
    render(CarnetTous, { props: { foods } });
    await fireEvent.click(screen.getByRole('button', { name: 'Fruits' }));
    await fireEvent.click(screen.getByRole('button', { name: 'tout' }));
    expect(screen.getByText('Carotte')).toBeTruthy();
  });

  it('renders the empty placeholder when foods is empty', () => {
    render(CarnetTous, { props: { foods: [] } });
    expect(screen.getByText('Aucun aliment ici')).toBeTruthy();
  });
});
