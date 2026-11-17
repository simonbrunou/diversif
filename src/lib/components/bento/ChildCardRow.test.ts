import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import { baseLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import ChildCardRow from './ChildCardRow.svelte';

afterEach(() => {
  cleanup();
  overwriteGetLocale(() => baseLocale);
});

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

  // The name starts with the text the row shows, so a speech-input user can
  // say « Léo 7 mois » (WCAG 2.5.3, #693). An aria-label would hide that text
  // from the name, and the initial would put a stray « L » in front of it.
  // The space before the comma is Chromium's too: `sr-only` positions the
  // hint absolutely, which makes it a block, and blocks are space-separated.
  it.each([
    ['fr', 'Léo 7 mois , ouvrir les réglages'],
    ['en', 'Léo 7 months , open settings']
  ] as const)('names the link with the shown name and age in %s', (locale, name) => {
    overwriteGetLocale(() => locale);
    render(ChildCardRow, {
      props: { child: { id: 'abc', name: 'Léo', ageMonths: 7 }, href: '/child/abc/settings' }
    });
    const link = screen.getByRole('link', { name });
    expect(link.getAttribute('aria-label')).toBeNull();
  });
});
