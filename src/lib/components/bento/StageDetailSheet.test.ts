// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import StageDetailSheet from './StageDetailSheet.svelte';

afterEach(() => cleanup());

describe('StageDetailSheet', () => {
  const stage = {
    id: '6-9m',
    title: '6 à 9 mois',
    oneLiner: 'Diversifier le panier',
    principles: ['Mixé puis écrasé', 'Une nouvelle saveur à la fois'],
    focus: ['Légumes verts', 'Fruits cuits', 'Céréales infantiles'],
    textures: 'Purées lisses puis écrasées',
    milkTarget: '600 à 800 ml de lait par jour',
    redFlags: ['Refus persistant > 1 semaine'],
    sources: ['ANSES-2019', 'ESPGHAN-2017']
  };

  it('renders nothing visible when open=false', () => {
    render(StageDetailSheet, { props: { open: false, stage } });
    // Dialog content is not rendered when closed (bits-ui Portal); title text absent
    expect(screen.queryByText('Mixé puis écrasé')).toBeNull();
  });

  it('renders the stage title and principles when open', () => {
    render(StageDetailSheet, { props: { open: true, stage } });
    expect(screen.getByText('6 à 9 mois')).toBeTruthy();
    expect(screen.getByText('Mixé puis écrasé')).toBeTruthy();
  });

  it('renders focus foods, textures, and milk target', () => {
    render(StageDetailSheet, { props: { open: true, stage } });
    expect(screen.getByText('Légumes verts')).toBeTruthy();
    expect(screen.getByText('Purées lisses puis écrasées')).toBeTruthy();
    expect(screen.getByText(/600 à 800 ml/)).toBeTruthy();
  });

  it('renders red flags when present', () => {
    render(StageDetailSheet, { props: { open: true, stage } });
    expect(screen.getByText('Refus persistant > 1 semaine')).toBeTruthy();
  });

  it('hides the red-flags section when empty', () => {
    const noRedFlags = { ...stage, redFlags: [] };
    const { container } = render(StageDetailSheet, { props: { open: true, stage: noRedFlags } });
    expect(container.textContent).not.toContain('À surveiller');
  });
});
