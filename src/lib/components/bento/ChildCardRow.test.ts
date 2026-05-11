// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ChildCardRow from './ChildCardRow.svelte';

afterEach(() => cleanup());

describe('ChildCardRow', () => {
  it('renders the child name and age', () => {
    render(ChildCardRow, {
      props: { child: { id: 'abc', name: 'Léo', ageMonths: 7 }, href: '/child/abc/settings' }
    });
    expect(screen.getByText('Léo')).toBeTruthy();
    expect(screen.getByText('7 mois')).toBeTruthy();
  });

  it('links to the settings href', () => {
    render(ChildCardRow, {
      props: { child: { id: 'abc', name: 'Léo', ageMonths: 7 }, href: '/child/abc/settings' }
    });
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/child/abc/settings');
  });

  it('renders an aria-label that names the child', () => {
    render(ChildCardRow, {
      props: { child: { id: 'abc', name: 'Léo', ageMonths: 7 }, href: '/child/abc/settings' }
    });
    expect(screen.getByLabelText('Ouvrir les réglages de Léo')).toBeTruthy();
  });
});
