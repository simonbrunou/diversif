import { describe, expect, it } from 'bun:test';
import { render, fireEvent, screen } from '@testing-library/svelte';
import '../../test/component';
import GuideStaticSections, { STATIC_NAV_SECTIONS } from './GuideStaticSections.svelte';

describe('GuideStaticSections', () => {
  it('exports the navigation section list', () => {
    expect(STATIC_NAV_SECTIONS.length).toBeGreaterThan(0);
    expect(STATIC_NAV_SECTIONS.find((s) => s.id === 'regles')).toBeTruthy();
  });

  it('renders all section anchors', () => {
    const { container } = render(GuideStaticSections, { props: {} });
    for (const s of STATIC_NAV_SECTIONS) {
      expect(container.querySelector(`#${s.id}`)).not.toBeNull();
    }
  });

  it('opens the allergen info dialog on click', async () => {
    render(GuideStaticSections, { props: {} });
    // The egg allergen card is a button. Find the first allergen "Voir les détails" trigger.
    const trigger = screen.getAllByRole('button').find((b) => b.textContent?.includes('détails'));
    if (trigger) {
      await fireEvent.click(trigger);
      const dlg = document.querySelector('[role="dialog"]');
      expect(dlg).not.toBeNull();
    }
  });

  it('marks the current stage when currentStageId is provided', () => {
    const { container } = render(GuideStaticSections, {
      props: { currentStageId: '4-6' }
    });
    // The stage card shows an "Actuelle" pill on the matching stage card.
    expect(container.textContent).toContain('Actuelle');
  });
});
