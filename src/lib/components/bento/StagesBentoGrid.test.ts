import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { baseLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import { expectPairedForeground } from '../../../test/paired-foreground';
import StagesBentoGrid from './StagesBentoGrid.svelte';

afterEach(() => {
  cleanup();
  overwriteGetLocale(() => baseLocale);
});

describe('StagesBentoGrid', () => {
  const stages = [
    { id: '4-6m', title: '4 à 6 mois', oneLiner: 'Démarrer en douceur' },
    { id: '6-9m', title: '6 à 9 mois', oneLiner: 'Diversifier le panier' },
    { id: '9-12m', title: '9 à 12 mois', oneLiner: 'Vers la cuillère' },
    { id: '12m+', title: '12 mois et plus', oneLiner: 'Vers la table familiale' }
  ];

  it('shows all four stage tiles with no expander', () => {
    render(StagesBentoGrid, { props: { stages, activeStageId: '6-9m', onOpen: () => {} } });
    expect(screen.getByText('4 à 6 mois')).toBeTruthy();
    expect(screen.getByText('6 à 9 mois')).toBeTruthy();
    expect(screen.getByText('9 à 12 mois')).toBeTruthy();
    expect(screen.getByText('12 mois et plus')).toBeTruthy();
    expect(screen.queryByText('Voir toutes les étapes')).toBeNull();
    expect(screen.queryByText('Voir moins')).toBeNull();
  });

  it('marks only the active stage with aria-current="step"', () => {
    render(StagesBentoGrid, { props: { stages, activeStageId: '6-9m', onOpen: () => {} } });
    const active = screen.getByText('6 à 9 mois').closest('button');
    expect(active?.getAttribute('aria-current')).toBe('step');
    // Non-active tiles must not be marked current — guards against a flipped
    // ternary marking every (or the wrong) tile as the screen-reader step.
    const inactive = screen.getByText('9 à 12 mois').closest('button');
    expect(inactive?.getAttribute('aria-current')).toBeNull();
  });

  // A tile's name is the text it shows, title then one-liner, so a
  // speech-input user can say what they see (WCAG 2.5.3, #693). The stage
  // titles and one-liners are content, in the same words in both locales.
  it.each(['fr', 'en'] as const)('names each tile with its title and one-liner in %s', (locale) => {
    overwriteGetLocale(() => locale);
    render(StagesBentoGrid, { props: { stages, activeStageId: '6-9m', onOpen: () => {} } });
    for (const { title, oneLiner } of stages) {
      const tile = screen.getByRole('button', { name: `${title} ${oneLiner}` });
      expect(tile.getAttribute('aria-label')).toBeNull();
    }
  });

  it("sets each stage tile's text in the tile's own foreground (#360)", () => {
    render(StagesBentoGrid, { props: { stages, activeStageId: '6-9m', onOpen: () => {} } });
    const tiles = screen.getAllByRole('button');
    expect(tiles.length).toBe(4);
    for (const tile of tiles) expectPairedForeground(tile);
  });

  it('calls onOpen with the stage id when a tile is tapped', async () => {
    const onOpen = mock();
    render(StagesBentoGrid, { props: { stages, activeStageId: '6-9m', onOpen } });
    await fireEvent.click(screen.getByText('9 à 12 mois'));
    expect(onOpen).toHaveBeenCalledWith('9-12m');
  });
});
