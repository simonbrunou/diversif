import { describe, expect, it, mock } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../test/component';
import FoodCombobox from './FoodCombobox.svelte';

const foods = [
  { id: 1, name: 'Carotte', category: 'legumes', allergenType: null },
  { id: 2, name: 'Pomme', category: 'fruits', allergenType: null },
  { id: 3, name: 'Œuf', category: 'oeufs', allergenType: 'oeuf' }
];

describe('FoodCombobox', () => {
  it('renders the food list initially', () => {
    const { container } = render(FoodCombobox, { props: { foods } });
    expect(container.textContent).toContain('Carotte');
    expect(container.textContent).toContain('Pomme');
    expect(container.textContent).toContain('Œuf');
  });

  it('filters by category when a chip is clicked', async () => {
    const { container } = render(FoodCombobox, { props: { foods } });
    const fruits = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Fruits'
    )!;
    await fireEvent.click(fruits);
    expect(container.textContent).toContain('Pomme');
    expect(container.textContent).not.toMatch(/Carotte/);
  });

  it('toggles the active category off when clicked again', async () => {
    const { container } = render(FoodCombobox, { props: { foods } });
    const fruits = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Fruits'
    )!;
    await fireEvent.click(fruits);
    await fireEvent.click(fruits);
    expect(container.textContent).toContain('Carotte');
  });

  it('selects a food and shows the summary', async () => {
    const { container } = render(FoodCombobox, { props: { foods } });
    const carrotBtn = Array.from(container.querySelectorAll('ul button')).find((b) =>
      b.textContent?.includes('Carotte')
    )!;
    await fireEvent.click(carrotBtn);
    expect(container.textContent).toContain('Carotte');
    expect(
      container.querySelector('input[type="hidden"][name="foodId"]')?.getAttribute('value')
    ).toBe('1');
  });

  it('clears selection via the "Changer" button', async () => {
    const { container } = render(FoodCombobox, { props: { foods, initialFoodId: 1 } });
    const change = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Changer'
    )!;
    await fireEvent.click(change);
    expect(container.querySelector('input[type="hidden"][name="foodId"]')).toBeNull();
  });

  it('opens the custom-food form and notifies via onCustomToggle', async () => {
    const onCustomToggle = mock();
    const { container } = render(FoodCombobox, {
      props: { foods, onCustomToggle }
    });
    const addBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('hors catalogue')
    )!;
    await fireEvent.click(addBtn);
    expect(onCustomToggle).toHaveBeenCalledWith(true);
    expect(container.querySelector('input[name="customFood.name"]')).not.toBeNull();
    expect(container.querySelector('select[name="customFood.category"]')).not.toBeNull();
  });

  it('shows "Aucun aliment trouvé." when search yields nothing', async () => {
    const { container } = render(FoodCombobox, { props: { foods } });
    const search = container.querySelector('input[type="search"]') as HTMLInputElement;
    await fireEvent.input(search, { target: { value: 'zzzzqqqq' } });
    expect(container.textContent).toContain('Aucun aliment');
  });

  it('shows "(approchant)" annotation for fuzzy-only matches', async () => {
    const { container } = render(FoodCombobox, { props: { foods } });
    const search = container.querySelector('input[type="search"]') as HTMLInputElement;
    await fireEvent.input(search, { target: { value: 'crt' } });
    expect(container.textContent).toContain('approchant');
  });
});
