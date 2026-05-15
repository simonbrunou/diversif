// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ProfilBento from './ProfilBento.svelte';

afterEach(() => cleanup());

describe('ProfilBento', () => {
  const baseProps = {
    children: [
      {
        id: 'a',
        name: 'Léo',
        ageMonths: 7,
        coparents: [{ id: '1', displayName: 'Alice', role: 'co-parent' }]
      }
    ],
    passkeyCount: 2,
    locale: 'fr' as const,
    theme: 'system' as const
  };

  it('renders all sections', () => {
    render(ProfilBento, { props: baseProps });
    expect(screen.getByText('Vos enfants')).toBeTruthy();
    expect(screen.getByText(/Co-parents/)).toBeTruthy();
    expect(screen.getByText('Compte')).toBeTruthy();
    expect(screen.getByText('Vos données (RGPD)')).toBeTruthy();
    expect(screen.getByText('Légal')).toBeTruthy();
  });

  it('renders the add-child row pointing at /child/new', () => {
    render(ProfilBento, {
      props: { children: [], passkeyCount: 0, locale: 'fr' as const, theme: 'system' as const }
    });
    const link = screen.getByText('Ajouter un enfant').closest('a');
    expect(link?.getAttribute('href')).toBe('/child/new');
  });

  it('renders all four legal links', () => {
    render(ProfilBento, { props: baseProps });
    expect(screen.getByText('CGU').closest('a')?.getAttribute('href')).toBe('/cgu');
    expect(screen.getByText('Mentions légales').closest('a')?.getAttribute('href')).toBe(
      '/mentions-legales'
    );
    expect(
      screen.getByText('Politique de confidentialité').closest('a')?.getAttribute('href')
    ).toBe('/politique-confidentialite');
    expect(screen.getByText('Cookies').closest('a')?.getAttribute('href')).toBe('/cookies');
  });
});
