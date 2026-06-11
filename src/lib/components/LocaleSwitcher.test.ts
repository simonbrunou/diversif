import { afterAll, describe, expect, it, mock } from 'bun:test';
import { render, screen } from '@testing-library/svelte';
import '../../test/component';

// Capture real exports BEFORE the per-file mocks so afterAll can restore
// them — bun:test's mock.module is process-global, so the languageTag/i18n
// overrides below would otherwise leak into every subsequent file.
import * as actualParaglide from '$lib/paraglide/runtime';
import * as actualI18n from '$lib/i18n';

import LocaleSwitcher from './LocaleSwitcher.svelte';

mock.module('$app/state', () => ({
  page: { url: { pathname: '/login', search: '', hash: '' } }
}));

mock.module('$app/environment', () => ({
  building: false
}));

mock.module('$lib/paraglide/runtime', () => ({
  ...actualParaglide,
  languageTag: mock(() => 'fr'),
  availableLanguageTags: ['fr', 'en'] as const
}));

mock.module('$lib/i18n', () => ({
  i18n: {
    resolveRoute: (path: string, locale: string) => (locale === 'fr' ? path : `/${locale}${path}`)
  }
}));

// Restore real modules after this file's tests so the next file isn't
// polluted by the languageTag = 'fr' mock here.
afterAll(() => {
  mock.module('$lib/paraglide/runtime', () => actualParaglide);
  mock.module('$lib/i18n', () => actualI18n);
});

describe('LocaleSwitcher', () => {
  it('renders both FR and EN as anchors with correct href', () => {
    render(LocaleSwitcher);
    const fr = screen.getByRole('link', { name: /fr/i });
    const en = screen.getByRole('link', { name: /en/i });
    expect(fr.getAttribute('href')).toBe('/login');
    expect(en.getAttribute('href')).toBe('/en/login');
  });

  it('marks the current locale with data-active and aria-current', () => {
    render(LocaleSwitcher);
    const fr = screen.getByRole('link', { name: /fr/i });
    const en = screen.getByRole('link', { name: /en/i });
    expect(fr.getAttribute('data-active')).toBe('true');
    expect(en.getAttribute('data-active')).toBeNull();
    expect(fr.getAttribute('aria-current')).toBe('true');
    expect(en.getAttribute('aria-current')).toBeNull();
  });

  it('strips the /en prefix before resolving (avoids /en/en/... and same-URL flips)', async () => {
    const state = await import('$app/state');
    const original = state.page.url;
    const runtime = await import('$lib/paraglide/runtime');
    runtime.languageTag.mockReturnValue('en');
    Object.assign(state.page, {
      url: { pathname: '/en/login', search: '', hash: '' }
    });
    try {
      render(LocaleSwitcher);
      const fr = screen.getByRole('link', { name: /fr/i });
      const en = screen.getByRole('link', { name: /en/i });
      expect(fr.getAttribute('href')).toBe('/login');
      expect(en.getAttribute('href')).toBe('/en/login');
    } finally {
      Object.assign(state.page, { url: original });
    }
  });

  it('preserves query string and hash when switching locales', async () => {
    const state = await import('$app/state');
    const original = state.page.url;
    Object.assign(state.page, {
      url: { pathname: '/signup', search: '?code=INVITE', hash: '#form' }
    });
    try {
      render(LocaleSwitcher);
      const fr = screen.getByRole('link', { name: /fr/i });
      const en = screen.getByRole('link', { name: /en/i });
      expect(fr.getAttribute('href')).toBe('/signup?code=INVITE#form');
      expect(en.getAttribute('href')).toBe('/en/signup?code=INVITE#form');
    } finally {
      Object.assign(state.page, { url: original });
    }
  });

  it('drops the query/hash suffix during prerender (building === true)', async () => {
    const state = await import('$app/state');
    const original = state.page.url;
    Object.assign(state.page, {
      url: { pathname: '/signup', search: '?code=INVITE', hash: '#form' }
    });
    // Re-mock the module (bun:test mock.module replaces the factory) rather
    // than assigning into the imported namespace — ESM namespace objects are
    // read-only and the previous `env.building = true` threw under bun.
    mock.module('$app/environment', () => ({ building: true }));
    try {
      render(LocaleSwitcher);
      const fr = screen.getByRole('link', { name: /fr/i });
      const en = screen.getByRole('link', { name: /en/i });
      expect(fr.getAttribute('href')).toBe('/signup');
      expect(en.getAttribute('href')).toBe('/en/signup');
    } finally {
      mock.module('$app/environment', () => ({ building: false }));
      Object.assign(state.page, { url: original });
    }
  });

  it('flips data-active and aria-current when languageTag is en', async () => {
    const runtime = await import('$lib/paraglide/runtime');
    runtime.languageTag.mockReturnValue('en');

    render(LocaleSwitcher);
    const fr = screen.getByRole('link', { name: /fr/i });
    const en = screen.getByRole('link', { name: /en/i });
    expect(fr.getAttribute('data-active')).toBeNull();
    expect(en.getAttribute('data-active')).toBe('true');
    expect(fr.getAttribute('aria-current')).toBeNull();
    expect(en.getAttribute('aria-current')).toBe('true');
  });

  it('renders ≥44px row options with endonym labels in the rows variant', async () => {
    const runtime = await import('$lib/paraglide/runtime');
    runtime.languageTag.mockReturnValue('fr');

    render(LocaleSwitcher, { props: { variant: 'rows' } });
    const fr = screen.getByRole('link', { name: /Français/ });
    const en = screen.getByRole('link', { name: /English/ });
    // min-h-11 = 44px: the /account/locale options are proper tap targets.
    expect(fr.className).toContain('min-h-11');
    expect(en.className).toContain('min-h-11');
    expect(fr.getAttribute('href')).toBe('/login');
    expect(en.getAttribute('href')).toBe('/en/login');
    expect(fr.getAttribute('aria-current')).toBe('true');
    expect(en.getAttribute('aria-current')).toBeNull();
  });
});
