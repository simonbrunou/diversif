import { afterEach, describe, expect, it } from 'bun:test';
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

  it('orders sections by the curated CATEGORIES order, localized labels shown', () => {
    const { container } = render(CarnetCategories, {
      props: {
        foods: [
          {
            id: 1,
            name: 'Yaourt',
            category: 'produits_laitiers',
            tried: 1,
            status: 'ras' as const
          },
          { id: 2, name: 'Poire', category: 'fruits', tried: 1, status: 'ras' as const },
          { id: 3, name: 'Carotte', category: 'legumes', tried: 1, status: 'ras' as const }
        ]
      }
    });
    // Curated order (légumes → fruits → … → produits laitiers), not the
    // alphabetical raw-id order (fruits, legumes, produits_laitiers).
    const order = [...container.querySelectorAll('details')].map((d) =>
      d.getAttribute('data-category')
    );
    expect(order).toEqual(['legumes', 'fruits', 'produits_laitiers']);
    expect(screen.getByText(/Produits laitiers \(1\)/)).toBeTruthy();
  });
});
