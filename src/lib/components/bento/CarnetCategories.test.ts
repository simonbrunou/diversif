// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import CarnetCategories from './CarnetCategories.svelte';

afterEach(() => cleanup());

describe('CarnetCategories', () => {
  const foods = [
    { id: 1, name: 'Poire', category: 'fruits', tried: 1, status: 'ras' as const },
    { id: 2, name: 'Banane', category: 'fruits', tried: 1, status: 'ras' as const },
    { id: 3, name: 'Carotte', category: 'legumes', tried: 1, status: 'ras' as const }
  ];

  it('renders one details element per non-empty category', () => {
    const { container } = render(CarnetCategories, { props: { foods } });
    expect(container.querySelectorAll('details').length).toBe(2);
  });

  it('places foods inside the expected category', () => {
    const { container } = render(CarnetCategories, { props: { foods } });
    const fruits = container.querySelector('details[data-category="fruits"]');
    expect(fruits?.textContent).toContain('Poire');
    expect(fruits?.textContent).toContain('Banane');
  });

  it('renders the empty state when foods is empty', () => {
    render(CarnetCategories, { props: { foods: [] } });
    expect(screen.getByText('Aucune catégorie pour l’instant')).toBeTruthy();
  });
});
