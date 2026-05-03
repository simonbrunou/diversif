// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../../test/component';
import LandingTrust from './LandingTrust.svelte';

describe('LandingTrust', () => {
  it('renders the trust headline + at least 3 unique source organisations', () => {
    const { container } = render(LandingTrust, { props: {} });
    expect(container.textContent).toContain('autorité');
    const items = container.querySelectorAll('ul li');
    expect(items.length).toBeGreaterThan(2);
    const links = container.querySelectorAll('a[href="/sources"]');
    expect(links.length).toBeGreaterThan(0);
  });
});
