import { describe, expect, it, mock } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../test/component';
import FoodCombobox from './FoodCombobox.svelte';

const foods = [
  { id: 1, name: 'Carotte', category: 'legumes', allergenType: null },
  { id: 2, name: 'Pomme', category: 'fruits', allergenType: null },
  { id: 3, name: 'Œuf', category: 'oeufs', allergenType: 'oeuf' }
];

function hiddenFoodIdValues(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('input[type="hidden"][name="foodId"]')).map(
    (el) => el.getAttribute('value')!
  );
}

function clickFoodInList(container: HTMLElement, foodName: string) {
  const btn = Array.from(container.querySelectorAll('ul button')).find((b) =>
    b.textContent?.includes(foodName)
  )!;
  return fireEvent.click(btn);
}

describe('FoodCombobox — multiple mode', () => {
  it('selects two foods and emits two hidden foodId inputs', async () => {
    const { container } = render(FoodCombobox, { props: { foods, multiple: true } });
    await clickFoodInList(container, 'Carotte');
    await clickFoodInList(container, 'Pomme');
    expect(hiddenFoodIdValues(container).sort()).toEqual(['1', '2']);
  });

  it('keeps the list visible after selecting instead of collapsing to a summary', async () => {
    const { container } = render(FoodCombobox, { props: { foods, multiple: true } });
    await clickFoodInList(container, 'Carotte');
    expect(container.querySelector('ul')).not.toBeNull();
    expect(container.textContent).toContain('Pomme');
    expect(container.textContent).toContain('Œuf');
  });

  it('shows a removable chip per selected food, list still visible', async () => {
    const { container } = render(FoodCombobox, { props: { foods, multiple: true } });
    await clickFoodInList(container, 'Carotte');
    // Discriminates from single-select's "Changer" button, which also matches
    // a naive aria-label substring search — the list must still be present too.
    expect(container.querySelector('ul')).not.toBeNull();
    expect(container.textContent).toContain('Carotte');
    const removeBtn = container.querySelector(
      'button[aria-label*="Carotte"]'
    ) as HTMLButtonElement | null;
    expect(removeBtn).not.toBeNull();
  });

  it('removes a food via its chip remove button', async () => {
    const { container } = render(FoodCombobox, { props: { foods, multiple: true } });
    await clickFoodInList(container, 'Carotte');
    expect(hiddenFoodIdValues(container)).toEqual(['1']);
    expect(container.querySelector('ul')).not.toBeNull();
    const removeBtn = container.querySelector('button[aria-label*="Carotte"]') as HTMLButtonElement;
    await fireEvent.click(removeBtn);
    expect(hiddenFoodIdValues(container)).toEqual([]);
  });

  it('toggles a food off when its list entry is clicked again', async () => {
    const { container } = render(FoodCombobox, { props: { foods, multiple: true } });
    await clickFoodInList(container, 'Carotte');
    await clickFoodInList(container, 'Carotte');
    expect(hiddenFoodIdValues(container)).toEqual([]);
  });

  it('calls onSelectionChange with the current ids on every toggle', async () => {
    const onSelectionChange = mock();
    const { container } = render(FoodCombobox, {
      props: { foods, multiple: true, onSelectionChange }
    });
    await clickFoodInList(container, 'Carotte');
    expect(onSelectionChange.mock.calls.at(-1)?.[0]).toEqual([1]);
    await clickFoodInList(container, 'Pomme');
    expect(onSelectionChange.mock.calls.at(-1)?.[0]).toEqual([1, 2]);
  });

  it('seeds the selection from initialFoodId when provided', () => {
    const { container } = render(FoodCombobox, {
      props: { foods, multiple: true, initialFoodId: 2 }
    });
    expect(hiddenFoodIdValues(container)).toEqual(['2']);
    expect(container.querySelector('ul')).not.toBeNull();
  });

  it('regression: without multiple, selecting a food still collapses to the single summary with exactly one hidden input', async () => {
    const { container } = render(FoodCombobox, { props: { foods } });
    await clickFoodInList(container, 'Carotte');
    expect(hiddenFoodIdValues(container)).toEqual(['1']);
    // Single-select replaces the list with a summary card + "Changer" button.
    expect(container.querySelector('ul')).toBeNull();
    expect(container.textContent).toContain('Changer');
  });
});
