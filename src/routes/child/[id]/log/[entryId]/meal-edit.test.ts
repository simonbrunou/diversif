import { describe, expect, it, mock } from 'bun:test';
import { render, fireEvent } from '@testing-library/svelte';
import '../../../../../test/component';

// $app/forms is already stubbed by bunfig.preload.ts's global default, but every
// sibling component test in this repo re-declares it locally for clarity/
// self-containment (see src/lib/components/ReactionPicker.test.ts,
// src/lib/components/ui/ConfirmModal.test.ts, log.hint.test.ts).
mock.module('$app/forms', () => ({
  enhance: () => ({ destroy: () => {} })
}));

// Static imports hoist above mock.module, so the component under test must be
// pulled in dynamically, after the mock above is registered (same recipe as
// log.hint.test.ts).
const { default: Page } = await import('./+page.svelte');

import type { PageData } from './$types';

function makeMealData(): PageData {
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
    meal: {
      mealId: 'meal-abc',
      members: [
        { id: 501, foodId: 10, foodName: 'Carotte', reaction: 'ras' },
        { id: 502, foodId: 11, foodName: 'Pomme', reaction: 'inconfort' }
      ]
    }
  } as unknown as PageData;
}

describe('child/[id]/log/[entryId] +page.svelte — meal mode', () => {
  it('renders one reaction.{id} control and one hidden reactionLoaded.{id} per member, carrying the loaded value', () => {
    const { container } = render(Page, { props: { data: makeMealData(), form: null } });

    for (const [id, reaction] of [
      [501, 'ras'],
      [502, 'inconfort']
    ] as const) {
      // The ReactionPicker rendered for this member: a fieldset of 3 radios
      // sharing name="reaction.{id}".
      const radios = Array.from(
        container.querySelectorAll<HTMLInputElement>(`input[name="reaction.${id}"]`)
      );
      expect(radios.length).toBe(3);
      const checked = radios.find((r) => r.checked);
      expect(checked?.value).toBe(reaction);

      // Exactly one hidden reactionLoaded.{id}, carrying the SAME loaded value.
      const hidden = container.querySelectorAll(
        `input[type="hidden"][name="reactionLoaded.${id}"]`
      );
      expect(hidden.length).toBe(1);
      expect((hidden[0] as HTMLInputElement).value).toBe(reaction);
    }
  });

  it('diverges reactionLoaded.{id} from the picker after an edit, so the dirty-only guard can fire', async () => {
    const { container } = render(Page, { props: { data: makeMealData(), form: null } });

    // Member 501 loaded as 'ras'. Edit its picker to 'reaction'.
    const target = container.querySelector<HTMLInputElement>(
      'input[name="reaction.501"][value="reaction"]'
    )!;
    expect(target).not.toBeNull();
    await fireEvent.click(target);

    // The mutable picker reflects the edit...
    expect(target.checked).toBe(true);

    // ...but the hidden reactionLoaded.501 MUST still hold the ORIGINAL loaded
    // value ('ras'), never the edited one. This divergence is exactly what
    // lets Task 9's dirty-only guard (`submitted !== loaded`) detect the
    // change server-side -- if this hidden input tracked the same mutable
    // state as the picker, submitted would always equal loaded and the
    // guard would never fire, so reaction edits would silently no-op.
    const hidden501 = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="reactionLoaded.501"]'
    )!;
    expect(hidden501.value).toBe('ras');

    // The OTHER member's snapshot and picker are untouched by member 501's edit.
    const hidden502 = container.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="reactionLoaded.502"]'
    )!;
    expect(hidden502.value).toBe('inconfort');
    const checked502 = Array.from(
      container.querySelectorAll<HTMLInputElement>('input[name="reaction.502"]')
    ).find((r) => r.checked);
    expect(checked502?.value).toBe('inconfort');
  });

  it('wires the three action targets: ?/update, a per-row ?/removeIngredient with the right removeId, and ?/deleteMeal', async () => {
    const { container } = render(Page, { props: { data: makeMealData(), form: null } });

    // Main submit -> ?/update. Every reaction.{id}/reactionLoaded.{id} lives
    // inside this same form.
    const updateForm = container.querySelector('form[action="?/update"]');
    expect(updateForm).not.toBeNull();
    expect(container.querySelectorAll('input[name^="reaction."]').length).toBeGreaterThan(0);

    // Each row's "Retirer" is a button carrying its own removeId as a
    // name/value pair (not a per-row hidden input -- see the comment in
    // +page.svelte on why: a hidden input duplicated per row would collide,
    // since FormData.get() always resolves to the FIRST same-named field
    // regardless of which row's button was clicked).
    const removeButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[formaction="?/removeIngredient"]')
    );
    expect(removeButtons.length).toBe(2);
    expect(removeButtons.every((b) => b.name === 'removeId')).toBe(true);
    expect(removeButtons.map((b) => b.value).sort()).toEqual(['501', '502']);
    // Every remove button lives inside the SAME form as the reaction pickers
    // (required so a real submit carries them together; also required for
    // valid HTML -- a nested <form> would be broken markup). Asserted via one
    // compound descendant-combinator query rather than comparing two separate
    // querySelector() results by reference: happy-dom returns reference-
    // distinct (but content-identical) nodes for the same live element across
    // separate queries/`.closest()` calls in this harness, so a `===` identity
    // check across two independent lookups is not reliable here.
    expect(container.querySelectorAll('form').length).toBe(1);
    expect(
      container.querySelectorAll('form[action="?/update"] button[formaction="?/removeIngredient"]')
        .length
    ).toBe(2);

    // "Supprimer le repas" reuses the single-entry edit's ConfirmModal
    // affordance, targeting ?/deleteMeal.
    const deleteTrigger = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Supprimer le repas')
    )!;
    expect(deleteTrigger).not.toBeUndefined();
    await fireEvent.click(deleteTrigger);
    // bits-ui's Portal moves dialog content outside `container`; query the document.
    const deleteForm = document.querySelector('form[action="?/deleteMeal"]');
    expect(deleteForm).not.toBeNull();
  });
});
