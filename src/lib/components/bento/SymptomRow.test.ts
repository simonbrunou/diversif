import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';

// The delete confirmation is a ConfirmModal (bits-ui Portal): happy-dom's
// cloneNode interaction with the Portal trips $app/forms' "method must be
// POST" guard, so stub `enhance` here like ConfirmModal.test.ts does.
mock.module('$app/forms', () => ({
  enhance: () => ({ destroy: () => {} })
}));

import SymptomRow from './SymptomRow.svelte';

afterEach(async () => {
  cleanup();
  // bits-ui releases its body-scroll lock on a short timeout. Let that cleanup
  // run while happy-dom's document still exists so it cannot fire after the
  // test environment has been torn down.
  await new Promise((resolve) => setTimeout(resolve, 50));
});

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

  it('opens a confirmation modal instead of submitting directly', async () => {
    render(SymptomRow, {
      props: { ...baseProps, label: 'rougeur', observedAt: '11:42', note: null }
    });
    // No form (and no destructive request possible) before confirmation.
    expect(document.querySelector('form')).toBeNull();

    await fireEvent.click(screen.getByRole('button', { name: 'Supprimer ce symptôme' }));

    expect(screen.getByText('Supprimer ce symptôme ?')).toBeTruthy();
    // bits-ui Portal moves dialog content outside `container`; query document.
    const form = document.querySelector('form');
    expect(form?.getAttribute('action')).toBe('/child/abc/foods/1?/deleteSymptom');
    expect(form?.getAttribute('method')?.toLowerCase()).toBe('post');
    const hidden = form?.querySelector('input[name="symptomId"]') as HTMLInputElement | null;
    expect(hidden?.value).toBe('7');
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
  });
});
