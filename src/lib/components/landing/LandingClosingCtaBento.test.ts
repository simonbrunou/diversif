// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import LandingClosingCtaBento from './LandingClosingCtaBento.svelte';

afterEach(() => cleanup());

describe('LandingClosingCtaBento', () => {
  it('renders the closing title and signup CTA', () => {
    render(LandingClosingCtaBento);
    expect(screen.getByText(/Prêt à commencer/)).toBeTruthy();
    const cta = screen.getByRole('link', { name: /Créer mon compte/ });
    expect(cta.getAttribute('href')).toBe('/signup');
  });
});
