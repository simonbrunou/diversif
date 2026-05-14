// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import AddSymptomSheet from './AddSymptomSheet.svelte';

afterEach(async () => {
  cleanup();
  // bits-ui releases its body-scroll lock on a short timeout. Let that cleanup
  // run while happy-dom's document still exists so it cannot fire after the
  // test environment has been torn down.
  await new Promise((resolve) => setTimeout(resolve, 50));
});

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

  it('preselects no symptom and disables submit until one is picked', () => {
    render(AddSymptomSheet, { props: { open: true, action: '/child/abc/foods/1' } });
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.every((r) => !r.checked)).toBe(true);
    const submit = screen.getByRole('button', {
      name: 'Enregistrer le symptôme'
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('tints severe symptom chips when unselected', () => {
    render(AddSymptomSheet, { props: { open: true, action: '/child/abc/foods/1' } });
    const severe = screen.getByText('Détresse respiratoire').closest('label');
    const mild = screen.getByText('Rougeur').closest('label');
    expect(severe?.className).toContain('border-destructive/40');
    expect(severe?.className).toContain('text-destructive');
    expect(mild?.className).not.toContain('border-destructive');
  });

  it('blocks submit (e.g. Enter key) while no symptom is picked', async () => {
    render(AddSymptomSheet, { props: { open: true, action: '/child/abc/foods/1' } });
    const form = screen.getByRole('button', { name: 'Enregistrer le symptôme' }).closest('form')!;
    const event = await fireEvent.submit(form);
    // fireEvent.submit returns false when a listener called preventDefault.
    expect(event).toBe(false);
  });
});
