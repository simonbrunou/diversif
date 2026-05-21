// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import DiscoverGroupHarness from './DiscoverGroup.test.svelte';

afterEach(() => cleanup());

describe('DiscoverGroup', () => {
  it('renders the visible label text', () => {
    render(DiscoverGroupHarness, { props: { label: 'Repères', tint: 'mint' } });
    expect(screen.getByText('Repères')).toBeTruthy();
  });

  it('exposes the label as the section accessible name via aria-label', () => {
    render(DiscoverGroupHarness, { props: { label: 'À essayer', tint: 'peach' } });
    const section = screen.getByRole('region', { name: 'À essayer' });
    expect(section).toBeTruthy();
  });

  it('marks the visible label as decorative (aria-hidden) to avoid duplicating the accessible name', () => {
    const { container } = render(DiscoverGroupHarness, {
      props: { label: 'Apprendre', tint: 'butter' }
    });
    const visible = container.querySelector('.discover-group__label');
    expect(visible).toBeTruthy();
    expect(visible?.getAttribute('aria-hidden')).toBe('true');
  });

  it.each([['mint' as const], ['peach' as const], ['butter' as const]])(
    'applies data-tint="%s" to the section',
    (tint) => {
      const { container } = render(DiscoverGroupHarness, { props: { label: 'X', tint } });
      expect(container.querySelector(`.discover-group[data-tint="${tint}"]`)).toBeTruthy();
    }
  );

  it('renders slotted children via the children snippet', () => {
    render(DiscoverGroupHarness, { props: { label: 'Repères', tint: 'mint' } });
    expect(screen.getByTestId('child-content')).toBeTruthy();
  });
});
