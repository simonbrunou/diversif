// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import CompteSection from './CompteSection.svelte';

afterEach(() => cleanup());

describe('CompteSection', () => {
  const baseProps = {
    passkeyCount: 2,
    locale: 'fr' as const,
    theme: 'system' as const
  };

  it('renders the four rows', () => {
    render(CompteSection, { props: baseProps });
    expect(screen.getByText("Clés d'accès")).toBeTruthy();
    expect(screen.getByText('Langue')).toBeTruthy();
    expect(screen.getByText('Thème')).toBeTruthy();
    expect(screen.getByText('Mot de passe')).toBeTruthy();
  });

  it('renders the passkey device count in plural', () => {
    render(CompteSection, { props: baseProps });
    expect(screen.getByText('2 appareils')).toBeTruthy();
  });

  it('renders 1 device in singular form', () => {
    render(CompteSection, { props: { ...baseProps, passkeyCount: 1 } });
    expect(screen.getByText('1 appareil')).toBeTruthy();
  });
});
