import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import ReassuranceHero from './ReassuranceHero.svelte';
import { expectPairedForeground } from '../../../test/paired-foreground';

afterEach(() => cleanup());

describe('ReassuranceHero', () => {
  it('renders the reassurance body copy', () => {
    render(ReassuranceHero, {});
    expect(screen.getByText(/On vous accompagne/)).toBeTruthy();
  });

  it("sets the hero in the peach tint's own foreground (#667)", () => {
    const { container } = render(ReassuranceHero, {});
    const hero = container.querySelector('section');
    if (!hero) throw new Error('no hero');
    expect(hero.classList.contains('bg-tile-peach')).toBe(true);
    expectPairedForeground(hero);
  });
});
