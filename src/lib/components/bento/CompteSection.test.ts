import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/svelte';
import CompteSection from './CompteSection.svelte';

afterEach(() => cleanup());

describe('CompteSection', () => {
  const baseProps = {
    passkeyCount: 2,
    locale: 'fr' as const,
    theme: 'system' as const
  };

  it('renders every account row', () => {
    render(CompteSection, { props: baseProps });
    expect(screen.getByText('Profil')).toBeTruthy();
    expect(screen.getByText('Clés d’accès')).toBeTruthy();
    expect(screen.getByText('Mot de passe')).toBeTruthy();
    expect(screen.getByText('Langue')).toBeTruthy();
    expect(screen.getByText('Thème')).toBeTruthy();
    expect(screen.getByText('Sessions')).toBeTruthy();
  });

  it('points each row at its dedicated sub-route', () => {
    render(CompteSection, { props: baseProps });
    expect(screen.getByText('Profil').closest('a')?.getAttribute('href')).toBe('/account/profile');
    expect(screen.getByText('Clés d’accès').closest('a')?.getAttribute('href')).toBe(
      '/account/passkeys'
    );
    expect(screen.getByText('Mot de passe').closest('a')?.getAttribute('href')).toBe(
      '/account/password'
    );
    expect(screen.getByText('Langue').closest('a')?.getAttribute('href')).toBe('/account/locale');
    expect(screen.getByText('Thème').closest('a')?.getAttribute('href')).toBe('/account/theme');
    expect(screen.getByText('Sessions').closest('a')?.getAttribute('href')).toBe(
      '/account/sessions'
    );
  });

  it('renders the passkey device count in plural', () => {
    render(CompteSection, { props: baseProps });
    expect(screen.getByText('2 appareils')).toBeTruthy();
  });

  it('renders 1 device in singular form', () => {
    render(CompteSection, { props: { ...baseProps, passkeyCount: 1 } });
    expect(screen.getByText('1 appareil')).toBeTruthy();
  });

  it('translates the theme meta to French for each value', () => {
    render(CompteSection, { props: { ...baseProps, theme: 'system' } });
    expect(screen.getByText('Auto')).toBeTruthy();
    cleanup();
    render(CompteSection, { props: { ...baseProps, theme: 'light' } });
    expect(screen.getByText('Clair')).toBeTruthy();
    cleanup();
    render(CompteSection, { props: { ...baseProps, theme: 'dark' } });
    expect(screen.getByText('Sombre')).toBeTruthy();
  });
});
