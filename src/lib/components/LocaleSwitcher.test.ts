import { describe, expect, it, mock } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen } from '@testing-library/svelte';
import '../../test/component';
import LocaleSwitcher from './LocaleSwitcher.svelte';

mock.module('$app/state', () => ({
  page: { url: { pathname: '/login', search: '', hash: '' } }
}));

mock.module('$app/environment', () => ({
  building: false
}));

mock.module('$lib/paraglide/runtime', () => ({
  languageTag: mock(() => 'fr'),
  availableLanguageTags: ['fr', 'en'] as const
}));

mock.module('$lib/i18n', () => ({
  i18n: {
    resolveRoute: (path: string, locale: string) => (locale === 'fr' ? path : `/${locale}${path}`)
  }
}));

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
    const env = await import('$app/environment');
    const state = await import('$app/state');
    const original = state.page.url;
    Object.assign(state.page, {
      url: { pathname: '/signup', search: '?code=INVITE', hash: '#form' }
    });
    env.building = true;
    try {
      render(LocaleSwitcher);
      const fr = screen.getByRole('link', { name: /fr/i });
      const en = screen.getByRole('link', { name: /en/i });
      expect(fr.getAttribute('href')).toBe('/signup');
      expect(en.getAttribute('href')).toBe('/en/signup');
    } finally {
      env.building = false;
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
});
