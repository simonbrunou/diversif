import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import DiscoverBento from './DiscoverBento.svelte';

afterEach(() => cleanup());

describe('DiscoverBento', () => {
  const stages = [
    {
      id: '4-6m',
      title: '4 à 6 mois',
      oneLiner: 'Démarrer en douceur',
      principles: [],
      focus: [],
      textures: '',
      milkTarget: '',
      redFlags: [],
      sources: []
    },
    {
      id: '6-9m',
      title: '6 à 9 mois',
      oneLiner: 'Diversifier',
      principles: [],
      focus: [],
      textures: '',
      milkTarget: '',
      redFlags: [],
      sources: []
    },
    {
      id: '9-12m',
      title: '9 à 12 mois',
      oneLiner: 'Cuillère',
      principles: [],
      focus: [],
      textures: '',
      milkTarget: '',
      redFlags: [],
      sources: []
    },
    {
      id: '12m+',
      title: '12 mois et plus',
      oneLiner: 'Famille',
      principles: [],
      focus: [],
      textures: '',
      milkTarget: '',
      redFlags: [],
      sources: []
    }
  ];

  const baseProps = {
    stages,
    activeStageId: '6-9m'
  };

  it('renders the stages grid', () => {
    render(DiscoverBento, { props: baseProps });
    expect(screen.getByText('Les étapes')).toBeTruthy();
  });

  it('renders no Sheet content while no stage is selected', () => {
    render(DiscoverBento, { props: baseProps });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders every stage tile in the grid', () => {
    render(DiscoverBento, { props: baseProps });
    expect(screen.getByText('6 à 9 mois')).toBeTruthy();
    expect(screen.getByText('9 à 12 mois')).toBeTruthy();
    expect(screen.queryByText('Voir toutes les étapes')).toBeNull();
  });

  it('opens the StageDetailSheet when a stage tile is tapped', async () => {
    render(DiscoverBento, { props: baseProps });
    await fireEvent.click(screen.getByText('9 à 12 mois'));
    expect(screen.getAllByText('Cuillère').length).toBeGreaterThanOrEqual(2);
  });
});
