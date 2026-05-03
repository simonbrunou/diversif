// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../../test/component';
import LandingHero from './LandingHero.svelte';

describe('LandingHero', () => {
  it('renders the headline and primary CTAs', () => {
    const { container } = render(LandingHero, { props: {} });
    expect(container.textContent).toContain('Diversifier en confiance');
    const links = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/signup');
    expect(links).toContain('/guide');
    expect(links).toContain('/login');
  });
});
