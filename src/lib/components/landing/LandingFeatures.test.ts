// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../../test/component';
import LandingFeatures from './LandingFeatures.svelte';

describe('LandingFeatures', () => {
  it('renders feature cards with icons and bodies', () => {
    const { container } = render(LandingFeatures, { props: {} });
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(2);
    expect(container.textContent).toContain('allergènes');
  });
});
