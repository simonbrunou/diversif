import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, cleanup } from '@testing-library/svelte';
import '../../../test/component';
import * as m from '$lib/paraglide/messages';
import type { CoparentEntry } from '$lib/server/guidance/queries/timeline';

// Component-level mocks for the dashboard page's non-DB dependencies, following
// the recipe used by src/routes/child/[id]/log/log.hint.test.ts (each bun:test
// file runs in its own isolated process — scripts/bun-test.ts — so these
// process-global mocks don't leak into other files).
//
// page.url is exposed through a getter reading a bare /child/1 URL: the page's
// milestone $effect reads page.url.searchParams, and with no `?logged=1` param
// pickMilestoneFromQuery returns null so the effect bails before touching
// toast/history. svelte-sonner's real dist can't load under bun test (its
// 'runed' peer import doesn't resolve — see form-toasts.test.ts), and the page
// imports it directly. $app/forms + $app/navigation are pulled in transitively
// by the child WelcomeDialog.
mock.module('$app/state', () => ({
  page: {
    get url() {
      return new URL('http://localhost/child/1');
    }
  }
}));
mock.module('svelte-sonner', () => ({
  toast: { error: () => {}, success: () => {} }
}));
mock.module('$app/forms', () => ({
  enhance: () => ({ destroy: () => {} })
}));
mock.module('$app/navigation', () => ({
  goto: async () => {}
}));

import type { PageData } from './$types';

// Static imports hoist above mock.module, so the component under test must be
// pulled in dynamically, after the mocks above are registered.
const { default: Page } = await import('./+page.svelte');

// A minimal PageData covering only the fields the dashboard render touches:
// the pre-diversification gate (ageMonths/stats), AujourdhuiBento's props, the
// milestone $effect (diversity.totalCategories), the WelcomeDialog (child.id,
// showWelcomeDialog:false → stays closed), and the co-parent section under
// test (coparentActivity).
function makeData(coparentActivity: CoparentEntry[]): PageData {
  return {
    child: { id: 1, name: 'Bébé', birthDate: '2024-01-01' },
    recent: [],
    stats: {
      foodsIntroduced: 5,
      weekCount: 2,
      allergens: { introduced: 0, total: 12, ras: 0, inconfort: 0, reaction: 0 }
    },
    bentoAllergens: [],
    diversity: { totalCategories: 8 },
    streak: 3,
    weeklyRecap: null,
    reminders: [],
    coparentActivity,
    showWelcomeDialog: false,
    ageMonths: 6
  } as unknown as PageData;
}

const mealPlusSingleton: CoparentEntry[] = [
  {
    id: 1,
    foodName: 'Carotte',
    category: 'legumes',
    reaction: 'ras',
    givenAt: Date.now(),
    loggedByName: 'Alice',
    mealId: 'meal-1'
  },
  {
    id: 2,
    foodName: 'Poire',
    category: 'fruits',
    reaction: 'ras',
    givenAt: Date.now(),
    loggedByName: 'Alice',
    mealId: 'meal-1'
  },
  {
    id: 3,
    foodName: 'Poulet',
    category: 'proteines',
    reaction: 'ras',
    givenAt: Date.now(),
    loggedByName: 'Alice',
    mealId: 'meal-1'
  },
  {
    id: 4,
    foodName: 'Pomme',
    category: 'fruits',
    reaction: 'ras',
    givenAt: Date.now() - 5000,
    loggedByName: 'Bob',
    mealId: null
  }
];

afterEach(() => cleanup());

describe('child/[id] +page.svelte — co-parent activity section wiring', () => {
  it('renders the section title + the grouped 3-ingredient line when coparentActivity is non-empty', () => {
    const { container } = render(Page, { props: { data: makeData(mealPlusSingleton) } });

    // The gated <section> is present: its SectionHeader title renders...
    expect(container.textContent).toContain(m.dashboardCoparentActivityTitle());
    // ...and the CoparentActivity feed folds the shared-mealId meal into ONE
    // "… 3 ingrédients" line (not three per-ingredient lines).
    expect(container.textContent).toContain(
      m.profilCoparentsActivityMeal({ name: 'Alice', count: 3 })
    );
    // The singleton keeps its own un-grouped line.
    expect(container.textContent).toContain(
      m.profilCoparentsActivityEntry({ name: 'Bob', food: 'Pomme' })
    );
  });

  it('omits the co-parent section entirely when coparentActivity is empty', () => {
    const { container } = render(Page, { props: { data: makeData([]) } });

    // The `{#if data.coparentActivity.length > 0}` gate keeps the whole
    // section (title included) out of the DOM for solo parents / no activity.
    expect(container.textContent).not.toContain(m.dashboardCoparentActivityTitle());
  });
});
