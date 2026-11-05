import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import LandingHeroBento from './LandingHeroBento.svelte';
import { expectPairedForeground } from '../../../test/paired-foreground';

afterEach(() => cleanup());

describe('LandingHeroBento', () => {
  it.each([
    ['signed-out', null],
    ['signed-in', { id: '1', name: 'Léo' }]
  ])(
    "sets the %s hero, title and links, in the peach tint's own foreground (#667)",
    (_who, child) => {
      const { container } = render(LandingHeroBento, { props: { child } });
      const hero = container.querySelector('section');
      if (!hero) throw new Error('no hero');
      expect(hero.classList.contains('bg-tile-peach')).toBe(true);
      expectPairedForeground(hero);
    }
  );

  it('renders the bento mark, headline, and signup CTA for signed-out visitors', () => {
    render(LandingHeroBento, { props: { child: null } });
    expect(screen.getByLabelText('Diversif')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Créer mon compte/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Se connecter/ })).toBeTruthy();
  });

  it('renders the continue-CTA for signed-in visitors with a child', () => {
    render(LandingHeroBento, {
      props: { child: { id: '1', name: 'Léo' } }
    });
    expect(screen.getByRole('link', { name: /Continuer avec Léo/ })).toBeTruthy();
  });

  it('shows the bento mark as a 48px brand mark', () => {
    const { container } = render(LandingHeroBento, { props: { child: null } });
    const mark = container.querySelector('[aria-label="Diversif"]') as HTMLElement;
    expect(mark.style.width).toBe('48px');
  });
});
