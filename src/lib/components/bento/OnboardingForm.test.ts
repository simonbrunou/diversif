// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import OnboardingForm from './OnboardingForm.svelte';

afterEach(() => cleanup());

describe('OnboardingForm', () => {
  it('renders prénom, date de naissance, invite checkbox, and submit', () => {
    render(OnboardingForm, { props: { errors: null } });
    expect(screen.getByLabelText('Prénom')).toBeTruthy();
    expect(screen.getByLabelText('Date de naissance')).toBeTruthy();
    expect(screen.getByLabelText('Inviter un co-parent maintenant')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeTruthy();
  });

  it('renders inline errors when provided', () => {
    render(OnboardingForm, {
      props: { errors: { firstName: 'Required' } }
    });
    expect(screen.getByText('Required')).toBeTruthy();
  });

  it('renders the birthDate error when provided', () => {
    render(OnboardingForm, {
      props: { errors: { birthDate: 'Invalid date' } }
    });
    expect(screen.getByText('Invalid date')).toBeTruthy();
  });
});
