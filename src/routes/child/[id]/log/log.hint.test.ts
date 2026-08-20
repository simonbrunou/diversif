import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../../../test/component';

// Component-level mocks for the page's non-DB dependencies, following the
// existing recipe used by src/lib/components/AppShellBento.test.ts and
// LocaleSwitcher.test.ts (each bun:test file runs in its own isolated
// process — scripts/bun-test.ts — so these process-global mocks don't leak
// into other test files).
//
// page.url is exposed through a getter reading this mutable `pageUrl`, so a
// test can drive the ?foodId= deep-link path by reassigning it before
// render() (the component reads page.url in its instance script on every
// mount). beforeEach resets it to the no-query default so the other tests
// see a bare /log URL.
const DEFAULT_URL = 'http://localhost/child/1/log';
let pageUrl = new URL(DEFAULT_URL);
mock.module('$app/state', () => ({
  page: {
    get url() {
      return pageUrl;
    }
  }
}));
mock.module('$app/forms', () => ({
  enhance: () => ({ destroy: () => {} })
}));
mock.module('$app/navigation', () => ({
  goto: async () => {},
  afterNavigate: () => {}
}));
mock.module('$app/environment', () => ({
  browser: false
}));
mock.module('svelte-sonner', () => ({
  toast: { error: () => {}, success: () => {} }
}));
mock.module('$lib/offline/queue', () => ({
  enqueue: async () => {}
}));

import type { PageData } from './$types';

// svelte-sonner's real dist can't load under bun test (its 'runed' peer
// import doesn't resolve from the install cache — see the identical note in
// src/lib/forms/form-toasts.test.ts), and +page.svelte imports it directly.
// Static imports hoist above mock.module, so Page must be pulled in
// dynamically, after the mocks above are registered.
const { default: Page } = await import('./+page.svelte');

const foods = [
  { id: 1, name: 'Carotte', category: 'legumes', allergenType: null },
  { id: 2, name: 'Pomme', category: 'fruits', allergenType: null },
  { id: 3, name: 'Riz', category: 'feculents', allergenType: null }
];

function makeData(
  introducedFoodIds: number[],
  preparedMeals: PageData['preparedMeals'] = []
): PageData {
  return {
    child: { id: 1, name: 'Bébé', birthDate: '2024-01-01' },
    foods,
    introducedFoodIds,
    preparedMeals
  } as unknown as PageData;
}

async function clickFood(container: HTMLElement, name: string) {
  const btn = Array.from(container.querySelectorAll('ul button')).find((b) =>
    b.textContent?.includes(name)
  )!;
  await fireEvent.click(btn);
}

const HINT_TEXT =
  'Plusieurs aliments jamais notés sont sélectionnés : enregistrez précisément chacun et la réaction observée.';

function hiddenFoodIdValues(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('input[type="hidden"][name="foodId"]')).map(
    (el) => el.getAttribute('value')!
  );
}

beforeEach(() => {
  pageUrl = new URL(DEFAULT_URL);
});

describe('log +page.svelte — multi-select help + never-tried hint', () => {
  it('renders the multi-select help text unconditionally', () => {
    const { container } = render(Page, { props: { data: makeData([]), form: null } });
    expect(container.textContent).toContain('Ajoutez tous les ingrédients du repas.');
  });

  it('stays hidden with zero or one never-tried food selected', async () => {
    const { container } = render(Page, { props: { data: makeData([]), form: null } });
    expect(container.textContent).not.toContain(HINT_TEXT);
    await clickFood(container, 'Carotte');
    expect(container.textContent).not.toContain(HINT_TEXT);
  });

  it('shows the hint once 2 never-tried foods are selected together', async () => {
    const { container } = render(Page, { props: { data: makeData([]), form: null } });
    await clickFood(container, 'Carotte');
    await clickFood(container, 'Pomme');
    expect(container.textContent).toContain(HINT_TEXT);
  });

  it('does not count already-introduced foods toward the hint', async () => {
    // Both foods about to be picked are already-tried for this child.
    const { container } = render(Page, { props: { data: makeData([1, 2]), form: null } });
    await clickFood(container, 'Carotte');
    await clickFood(container, 'Pomme');
    expect(container.textContent).not.toContain(HINT_TEXT);
  });

  it('counts an in-progress custom food toward the hint via onCustomToggle (not the combobox internal state)', async () => {
    const { container } = render(Page, { props: { data: makeData([]), form: null } });
    await clickFood(container, 'Carotte'); // 1 never-tried catalog food
    const addCustomBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('hors catalogue')
    )!;
    await fireEvent.click(addCustomBtn); // opens the custom-food form -> +1
    expect(container.textContent).toContain(HINT_TEXT);
  });

  it('seeds a ?foodId= deep link into the multiple picker: hidden input present + counts toward the hint at mount', async () => {
    // Deep-link to a NEVER-TRIED food (id 3 / Riz — not in introducedFoodIds).
    // This is the menu / suggestions / reminders "log this now" CTA path, which
    // now renders through FoodCombobox's *multiple* branch. Regression guard:
    // dropping initialFoodIds from <FoodCombobox> (as "redundant") would leave
    // no chip and no hidden foodId input, silently omitting the deep-linked
    // food from submission.
    pageUrl = new URL('http://localhost/child/1/log?foodId=3');
    const { container } = render(Page, { props: { data: makeData([]), form: null } });

    // (a) The deep-linked food actually submits: a hidden foodId input carries id 3.
    expect(hiddenFoodIdValues(container)).toContain('3');
    // Only one never-tried food so far, so the hint is still hidden.
    expect(container.textContent).not.toContain(HINT_TEXT);

    // (b) Clicking exactly ONE more never-tried food trips the hint — proving the
    // deep-linked food already counted at mount (page selectedIds and the
    // combobox's internal set agree from the start, not after a user re-click).
    await clickFood(container, 'Carotte');
    expect(hiddenFoodIdValues(container).sort()).toEqual(['1', '3']);
    expect(container.textContent).toContain(HINT_TEXT);
  });

  it('prefills every ingredient when a saved prepared meal is selected', async () => {
    const data = makeData(
      [],
      [
        {
          id: 7,
          brand: 'Blédina',
          name: 'Légumes et riz',
          foodIds: [1, 3],
          lastUsedAt: null
        }
      ]
    );
    const { container } = render(Page, { props: { data, form: null } });

    const mealButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Légumes et riz')
    )!;
    await fireEvent.click(mealButton);

    expect(hiddenFoodIdValues(container)).toEqual(['1', '3']);
    expect(
      container.querySelector('input[type="hidden"][name="preparedMealId"]')?.getAttribute('value')
    ).toBe('7');
  });
});
