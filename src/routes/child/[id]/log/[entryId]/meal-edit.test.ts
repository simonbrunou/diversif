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

  it('posts ?/update and structurally cannot delete an ingredient on Enter (no removeIngredient submit in the update form; first submit routes to ?/update)', () => {
    const { container } = render(Page, { props: { data: makeMealData(), form: null } });

    // Main submit -> ?/update; every reaction.{id}/reactionLoaded.{id} lives
    // inside this one form.
    const updateForm = container.querySelector('form[action="?/update"]')!;
    expect(updateForm).not.toBeNull();
    expect(updateForm.querySelectorAll('input[name^="reaction."]').length).toBeGreaterThan(0);

    // The Critical regression this locks out: a per-row "Retirer" rendered as a
    // type="submit" with formaction="?/removeIngredient" would sit BEFORE
    // "Enregistrer" in tree order, so it would be the form's implicit default
    // submit -- pressing Enter in the datetime-local field would fire it and
    // silently DELETE the first ingredient (native implicit submission; enhance
    // doesn't change event.submitter). happy-dom can't fire native implicit
    // submit, so we lock the invariant structurally instead:
    //   (a) no button in the update form targets ?/removeIngredient, and
    //   (b) the first (here: only) submit button carries no formaction override,
    //       so Enter routes to the form's own ?/update.
    expect(updateForm.querySelectorAll('button[formaction="?/removeIngredient"]').length).toBe(0);
    const submitButtons = Array.from(
      updateForm.querySelectorAll<HTMLButtonElement>('button[type="submit"]')
    );
    expect(submitButtons.length).toBeGreaterThan(0);
    expect(submitButtons[0].getAttribute('formaction')).toBeNull();
    expect(submitButtons.every((b) => b.getAttribute('formaction') === null)).toBe(true);

    // The per-row "Retirer" controls still exist -- as plain type="button"
    // triggers (they open a confirm), NOT submit buttons.
    const retirerButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button')
    ).filter((b) => b.type === 'button' && b.textContent?.includes('Retirer'));
    expect(retirerButtons.length).toBe(2);
  });

  it('clicking "Retirer" opens a confirm dialog instead of submitting immediately', async () => {
    const { container } = render(Page, { props: { data: makeMealData(), form: null } });

    // No removeIngredient form exists before the click (the confirm is closed).
    expect(document.querySelector('form[action="?/removeIngredient"]')).toBeNull();

    const retirerButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button')
    ).filter((b) => b.type === 'button' && b.textContent?.includes('Retirer'));
    expect(retirerButtons.length).toBe(2);

    await fireEvent.click(retirerButtons[0]);

    // The click opens the confirm modal, which portals a ?/removeIngredient
    // form into the document (bits-ui Portal renders outside `container`) --
    // no POST happens until the user confirms.
    expect(document.querySelector('form[action="?/removeIngredient"]')).not.toBeNull();
  });

  it("confirming the remove dialog posts ?/removeIngredient with the clicked row's removeId + from", async () => {
    const { container } = render(Page, { props: { data: makeMealData(), form: null } });
    // Guard against a stale portal leaking from a prior test.
    expect(document.querySelector('form[action="?/removeIngredient"]')).toBeNull();

    const retirerButtons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button')
    ).filter((b) => b.type === 'button' && b.textContent?.includes('Retirer'));
    // Click the SECOND row (member 502) to prove the dialog is parameterized by
    // which ingredient was chosen -- not hard-wired to the first row.
    await fireEvent.click(retirerButtons[1]);

    const removeForm = document.querySelector('form[action="?/removeIngredient"]')!;
    expect(removeForm).not.toBeNull();
    const removeId = removeForm.querySelector<HTMLInputElement>('input[name="removeId"]');
    expect(removeId?.value).toBe('502');
    // `from` threads through the same way the other actions forward it.
    const from = removeForm.querySelector<HTMLInputElement>('input[name="from"]');
    expect(from?.value).toBe('foods');
  });

  it('"Supprimer le repas" opens a ?/deleteMeal confirm (reusing the single-entry ConfirmModal affordance)', async () => {
    const { container } = render(Page, { props: { data: makeMealData(), form: null } });

    const deleteTrigger = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Supprimer le repas')
    )!;
    expect(deleteTrigger).not.toBeUndefined();
    await fireEvent.click(deleteTrigger);
    // bits-ui's Portal moves dialog content outside `container`; query the document.
    expect(document.querySelector('form[action="?/deleteMeal"]')).not.toBeNull();
  });
});
