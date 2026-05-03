// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../../test/component';
import LandingClosingCta from './LandingClosingCta.svelte';

describe('LandingClosingCta', () => {
  it('renders the closing headline and CTAs', () => {
    const { container } = render(LandingClosingCta, { props: {} });
    expect(container.textContent).toContain('Prêt');
    const links = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(links).toContain('/signup');
    expect(links).toContain('/guide');
  });
});
