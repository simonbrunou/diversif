import { describe, expect, it, mock } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../../../../test/component';

// Same setup as meal-edit.test.ts: a svelte-sonner stub, then the page
// imported dynamically so the mock registers first.
mock.module('svelte-sonner', () => ({
  toast: { error: () => {}, success: () => {} }
}));

const { default: Page } = await import('./+page.svelte');

import type { PageData } from './$types';

function makeEntryData(from: 'dashboard' | 'detail' | 'foods' = 'foods'): PageData {
  return {
    child: { id: 1, name: 'Bébé', birthDate: '2024-01-01' },
    foods: [],
    entry: {
      id: 501,
      foodId: 10,
      givenAt: new Date('2024-06-01T10:00:00Z').getTime(),
      reaction: 'ras',
      texture: null,
      notes: null
    },
    from,
    meal: null
  } as unknown as PageData;
}

describe('child/[id]/log/[entryId] +page.svelte — single entry', () => {
  it('renders a hidden reactionLoaded with the loaded reaction, which does not follow the picker (#421)', async () => {
    const { container } = render(Page, { props: { data: makeEntryData(), form: null } });

    const updateForm = container.querySelector('form[action^="?/update"]')!;
    const hidden = updateForm.querySelectorAll<HTMLInputElement>(
      'input[type="hidden"][name="reactionLoaded"]'
    );
    expect(hidden.length).toBe(1);
    expect(hidden[0].value).toBe('ras');

    // The parent changes the reaction: the picker moves, the snapshot stays,
    // so the server can tell a deliberate change from a stale form.
    const target = updateForm.querySelector<HTMLInputElement>(
      'input[name="reaction"][value="inconfort"]'
    )!;
    expect(target).not.toBeNull();
    await fireEvent.click(target);
    expect(target.checked).toBe(true);
    expect(hidden[0].value).toBe('ras');
  });

  // Without JavaScript the browser posts to the action URL and SvelteKit
  // renders a refusal there, so `load` reads `from` from that URL (#443).
  it.each(['detail', 'dashboard', 'foods'] as const)(
    'posts the update to an action URL that keeps from=%s',
    (from) => {
      const { container } = render(Page, { props: { data: makeEntryData(from), form: null } });
      const updateForm = container.querySelector('form[action^="?/update"]')!;
      expect(updateForm.getAttribute('action')).toBe(`?/update&from=${from}`);
    }
  );

  it('shows a refused update inside the entry form', () => {
    const { container } = render(Page, {
      props: { data: makeEntryData(), form: { errorKey: 'errorsLogIdempotencyConflict' } }
    });
    const alerts = container.querySelectorAll('form[action^="?/update"] [role="alert"]');
    expect(alerts.length).toBe(1);
    expect(alerts[0].textContent?.trim()).toBe('Conflit de clé d’idempotence.');
  });
});
