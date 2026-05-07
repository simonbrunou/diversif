// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import '../../test/component';
import LocaleSwitcher from './LocaleSwitcher.svelte';

vi.mock('$app/state', () => ({
  page: { url: { pathname: '/login' } }
}));

vi.mock('$lib/paraglide/runtime', () => ({
  languageTag: vi.fn(() => 'fr'),
  availableLanguageTags: ['fr', 'en'] as const
}));

vi.mock('$lib/i18n', () => ({
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

  it('marks the current locale with data-active', () => {
    render(LocaleSwitcher);
    const fr = screen.getByRole('link', { name: /fr/i });
    const en = screen.getByRole('link', { name: /en/i });
    expect(fr.getAttribute('data-active')).toBe('true');
    expect(en.getAttribute('data-active')).toBeNull();
  });

  it('flips data-active when languageTag is en', async () => {
    const runtime = await import('$lib/paraglide/runtime');
    vi.mocked(runtime.languageTag).mockReturnValue('en');

    render(LocaleSwitcher);
    const fr = screen.getByRole('link', { name: /fr/i });
    const en = screen.getByRole('link', { name: /en/i });
    expect(fr.getAttribute('data-active')).toBeNull();
    expect(en.getAttribute('data-active')).toBe('true');
  });
});
