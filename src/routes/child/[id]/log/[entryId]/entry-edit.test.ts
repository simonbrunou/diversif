import { describe, expect, it, mock } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../../../../test/component';

// Same setup as meal-edit.test.ts: a local $app/forms stub, then the page
// imported dynamically so the mock registers first.
mock.module('$app/forms', () => ({
  enhance: () => ({ destroy: () => {} })
}));

const { default: Page } = await import('./+page.svelte');

import type { PageData } from './$types';

function makeEntryData(): PageData {
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
    from: 'foods',
    meal: null
  } as unknown as PageData;
}

describe('child/[id]/log/[entryId] +page.svelte — single entry', () => {
  it('sends the loaded reaction in a hidden reactionLoaded that does not follow the picker (#421)', async () => {
    const { container } = render(Page, { props: { data: makeEntryData(), form: null } });

    const updateForm = container.querySelector('form[action="?/update"]')!;
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
    await fireEvent.click(target);
    expect(target.checked).toBe(true);
    expect(hidden[0].value).toBe('ras');
  });
});
