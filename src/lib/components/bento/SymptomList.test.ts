import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import SymptomList from './SymptomList.svelte';

afterEach(() => cleanup());

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

  it('passes the delete action and symptom id to each row', () => {
    const { container } = render(SymptomList, {
      props: { symptoms, onAdd: () => {}, action }
    });
    const forms = container.querySelectorAll(`form[action="${action}?/deleteSymptom"]`);
    expect(forms.length).toBe(symptoms.length);
    const ids = Array.from(forms).map(
      (f) => (f.querySelector('input[name="symptomId"]') as HTMLInputElement | null)?.value
    );
    expect(ids).toEqual(symptoms.map((s) => String(s.id)));
  });
});
