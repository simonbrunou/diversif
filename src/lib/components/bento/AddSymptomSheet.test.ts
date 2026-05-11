// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import AddSymptomSheet from './AddSymptomSheet.svelte';

afterEach(() => cleanup());

describe('AddSymptomSheet', () => {
  it('does not render Sheet content when open=false', () => {
    render(AddSymptomSheet, { props: { open: false, action: '/child/abc/foods/1' } });
    expect(screen.queryByText('Quel symptôme ?')).toBeNull();
  });

  it('renders all 10 picklist labels when open', () => {
    render(AddSymptomSheet, { props: { open: true, action: '/child/abc/foods/1' } });
    expect(screen.getByText('Rougeur')).toBeTruthy();
    expect(screen.getByText('Urticaire')).toBeTruthy();
    expect(screen.getByText('Eczéma')).toBeTruthy();
    expect(screen.getByText('Vomissement')).toBeTruthy();
    expect(screen.getByText('Diarrhée')).toBeTruthy();
    expect(screen.getByText('Gonflement')).toBeTruthy();
    expect(screen.getByText('Toux')).toBeTruthy();
    expect(screen.getByText('Détresse respiratoire')).toBeTruthy();
    expect(screen.getByText('Lèvres bleues')).toBeTruthy();
    expect(screen.getByText('Autre')).toBeTruthy();
  });

  it('renders the note input + submit', () => {
    render(AddSymptomSheet, { props: { open: true, action: '/child/abc/foods/1' } });
    expect(screen.getByLabelText('Note (optionnelle)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Enregistrer le symptôme' })).toBeTruthy();
  });

  it('submits the form to the provided action with ?/addSymptom', () => {
    render(AddSymptomSheet, { props: { open: true, action: '/child/abc/foods/1' } });
    const form = screen.getByRole('button', { name: 'Enregistrer le symptôme' }).closest('form');
    expect(form?.getAttribute('action')).toBe('/child/abc/foods/1?/addSymptom');
    expect(form?.getAttribute('method')).toBe('POST');
  });
});
