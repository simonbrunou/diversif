import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import StagesBentoGrid from './StagesBentoGrid.svelte';

afterEach(() => cleanup());

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

  it('calls onOpen with the stage id when a tile is tapped', async () => {
    const onOpen = mock();
    render(StagesBentoGrid, { props: { stages, activeStageId: '6-9m', onOpen } });
    await fireEvent.click(screen.getByText('9 à 12 mois'));
    expect(onOpen).toHaveBeenCalledWith('9-12m');
  });
});
