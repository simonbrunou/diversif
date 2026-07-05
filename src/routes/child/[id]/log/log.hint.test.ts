import { describe, expect, it, mock } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../../../test/component';

// Component-level mocks for the page's non-DB dependencies, following the
// existing recipe used by src/lib/components/AppShellBento.test.ts and
// LocaleSwitcher.test.ts (each bun:test file runs in its own isolated
// process — scripts/bun-test.ts — so these process-global mocks don't leak
// into other test files).
mock.module('$app/state', () => ({
  page: { url: new URL('http://localhost/child/1/log') }
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

function makeData(introducedFoodIds: number[]): PageData {
  return {
    child: { id: 1, name: 'Bébé', birthDate: '2024-01-01' },
    foods,
    introducedFoodIds
  } as unknown as PageData;
}

async function clickFood(container: HTMLElement, name: string) {
  const btn = Array.from(container.querySelectorAll('ul button')).find((b) =>
    b.textContent?.includes(name)
  )!;
  await fireEvent.click(btn);
}

const HINT_TEXT =
  'Introduisez les nouveaux aliments un par un pour repérer plus facilement une réaction.';

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
});
