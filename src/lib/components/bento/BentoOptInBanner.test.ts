// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import BentoOptInBanner from './BentoOptInBanner.svelte';

afterEach(() => cleanup());

describe('BentoOptInBanner', () => {
  it('renders title, subtitle, CTA, and dismiss button', () => {
    render(BentoOptInBanner, { props: { childId: 'abc' } });
    expect(screen.getByText(/nouveau design est prêt/i)).toBeTruthy();
    expect(screen.getByText(/Voulez-vous l'essayer/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Essayer le nouveau design/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fermer le panneau' })).toBeTruthy();
  });

  it('CTA submits to ?/optInBento via form POST', () => {
    render(BentoOptInBanner, { props: { childId: 'abc' } });
    const form = screen.getByRole('button', { name: /Essayer le nouveau design/ }).closest('form');
    expect(form?.getAttribute('action')).toBe('/child/abc?/optInBento');
    expect(form?.getAttribute('method')).toBe('POST');
  });

  it('hides itself when bento-opt-in-dismissed=1 cookie is present', () => {
    document.cookie = 'bento-opt-in-dismissed=1; path=/';
    const { container } = render(BentoOptInBanner, { props: { childId: 'abc' } });
    expect(container.querySelector('aside')).toBeNull();
    document.cookie = 'bento-opt-in-dismissed=; path=/; max-age=0';
  });
});
