import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import LandingTrustBento from './LandingTrustBento.svelte';
import { expectPairedForeground } from '../../../test/paired-foreground';

afterEach(() => cleanup());

describe('LandingTrustBento', () => {
  it('renders the section title', () => {
    render(LandingTrustBento);
    expect(screen.getByText('De la confiance, par construction')).toBeTruthy();
  });

  it("sets the section in the sky tint's own foreground, and keeps ink on the white pillars (#667)", () => {
    const { container } = render(LandingTrustBento);
    const section = container.querySelector('section');
    if (!section) throw new Error('no section');
    expect(section.classList.contains('bg-tile-sky')).toBe(true);
    expectPairedForeground(section);
    for (const pillar of section.querySelectorAll('li')) {
      expect(pillar.classList.contains('bg-surface')).toBe(true);
      expect(pillar.classList.contains('text-foreground')).toBe(true);
    }
  });
});
