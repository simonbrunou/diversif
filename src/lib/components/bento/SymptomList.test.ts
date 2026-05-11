// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import SymptomList from './SymptomList.svelte';

afterEach(() => cleanup());

describe('SymptomList', () => {
  const symptoms = [
    { id: 1, label: 'rougeur' as const, observedAt: '11:42', note: 'joue gauche' },
    { id: 2, label: 'vomissement' as const, observedAt: '12:10', note: null }
  ];

  it('renders one row per symptom', () => {
    render(SymptomList, { props: { symptoms, onAdd: () => {} } });
    expect(screen.getByText('Rougeur')).toBeTruthy();
    expect(screen.getByText('Vomissement')).toBeTruthy();
  });

  it('renders the empty placeholder when list is empty', () => {
    render(SymptomList, { props: { symptoms: [], onAdd: () => {} } });
    expect(screen.getByText("Aucun symptôme enregistré pour l'instant.")).toBeTruthy();
  });

  it('calls onAdd when the add button is tapped', async () => {
    const onAdd = vi.fn();
    render(SymptomList, { props: { symptoms, onAdd } });
    await fireEvent.click(screen.getByText('Ajouter un symptôme'));
    expect(onAdd).toHaveBeenCalled();
  });
});
