import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';

// Rows render their delete confirmation through ConfirmModal (bits-ui
// Portal): stub `enhance` like ConfirmModal.test.ts does, since happy-dom's
// cloneNode interaction with the Portal trips $app/forms' POST guard.
mock.module('$app/forms', () => ({
  enhance: () => ({ destroy: () => {} })
}));

import SymptomList from './SymptomList.svelte';

afterEach(async () => {
  cleanup();
  // Let bits-ui's body-scroll-lock timeout run before happy-dom tears down.
  await new Promise((resolve) => setTimeout(resolve, 50));
});

describe('SymptomList', () => {
  const symptoms = [
    { id: 1, label: 'rougeur' as const, observedAt: '11:42', note: 'joue gauche' },
    { id: 2, label: 'vomissement' as const, observedAt: '12:10', note: null }
  ];

  const action = '/child/abc/foods/1';

  it('renders one row per symptom', () => {
    render(SymptomList, { props: { symptoms, onAdd: () => {}, action } });
    expect(screen.getByText('Rougeur')).toBeTruthy();
    expect(screen.getByText('Vomissement')).toBeTruthy();
  });

  it('renders the empty placeholder when list is empty', () => {
    render(SymptomList, { props: { symptoms: [], onAdd: () => {}, action } });
    expect(screen.getByText('Aucun symptôme enregistré pour l’instant.')).toBeTruthy();
  });

  it('calls onAdd when the add button is tapped', async () => {
    const onAdd = mock();
    render(SymptomList, { props: { symptoms, onAdd, action } });
    await fireEvent.click(screen.getByText('Ajouter un symptôme'));
    expect(onAdd).toHaveBeenCalled();
  });

  it('passes the delete action and symptom id to each row via its confirm modal', async () => {
    render(SymptomList, {
      props: { symptoms, onAdd: () => {}, action }
    });
    // Each row exposes a delete button; the form only exists once the
    // row's ConfirmModal is opened (bits-ui portals it onto document).
    const deleteButtons = screen.getAllByRole('button', { name: 'Supprimer ce symptôme' });
    expect(deleteButtons.length).toBe(symptoms.length);

    await fireEvent.click(deleteButtons[1]!);
    const form = document.querySelector(`form[action="${action}?/deleteSymptom"]`);
    expect(form).not.toBeNull();
    const hidden = form?.querySelector('input[name="symptomId"]') as HTMLInputElement | null;
    expect(hidden?.value).toBe(String(symptoms[1]!.id));
  });
});
