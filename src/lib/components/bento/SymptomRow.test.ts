import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/svelte';
import SymptomRow from './SymptomRow.svelte';

afterEach(() => cleanup());

const baseProps = { id: 7, action: '/child/abc/foods/1' };

describe('SymptomRow', () => {
  it.each([
    ['urticaire', 'Urticaire'],
    ['eczema', 'Eczéma'],
    ['diarrhee', 'Diarrhée'],
    ['toux', 'Toux'],
    ['detresse-respiratoire', 'Détresse respiratoire'],
    ['levres-bleues', 'Lèvres bleues'],
    ['autre', 'Autre']
  ] as const)('renders label %s as %s', (label, expected) => {
    render(SymptomRow, { props: { ...baseProps, label, observedAt: '12:00', note: null } });
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it('renders the label, time, and optional note', () => {
    render(SymptomRow, {
      props: { ...baseProps, label: 'rougeur', observedAt: '11:42', note: 'sur la joue gauche' }
    });
    expect(screen.getByText('Rougeur')).toBeTruthy();
    expect(screen.getByText('11:42')).toBeTruthy();
    expect(screen.getByText('sur la joue gauche')).toBeTruthy();
  });

  it('hides the note paragraph when note is null', () => {
    const { container } = render(SymptomRow, {
      props: { ...baseProps, label: 'rougeur', observedAt: '11:42', note: null }
    });
    const noteCount = container.querySelectorAll('p').length;
    expect(noteCount).toBe(1);
  });

  it('applies butter background for warn severity', () => {
    const { container } = render(SymptomRow, {
      props: { ...baseProps, label: 'vomissement', observedAt: '12:00', note: null }
    });
    expect(container.querySelector('.bg-tile-butter')).toBeTruthy();
  });

  it('applies severe background and aria-live for severe severity', () => {
    const { container } = render(SymptomRow, {
      props: { ...baseProps, label: 'gonflement', observedAt: '12:00', note: null }
    });
    expect(container.querySelector('.bg-severe')).toBeTruthy();
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
  });

  it('renders a delete form with the symptom id and deleteSymptom action', () => {
    const { container } = render(SymptomRow, {
      props: { ...baseProps, label: 'rougeur', observedAt: '11:42', note: null }
    });
    const form = container.querySelector('form');
    expect(form?.getAttribute('action')).toBe('/child/abc/foods/1?/deleteSymptom');
    const hidden = form?.querySelector('input[name="symptomId"]') as HTMLInputElement | null;
    expect(hidden?.value).toBe('7');
    expect(screen.getByRole('button', { name: 'Supprimer ce symptôme' })).toBeTruthy();
  });
});
