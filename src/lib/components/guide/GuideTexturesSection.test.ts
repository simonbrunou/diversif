import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/svelte';
import '../../../test/component';
import { expectPairedForeground } from '../../../test/paired-foreground';
import GuideTexturesSection from './GuideTexturesSection.svelte';

describe('GuideTexturesSection', () => {
  it("sets the choking card, safety note included, in the inconfort tint's own foreground (#649)", () => {
    render(GuideTexturesSection);
    const card = screen.getByText(/Étouffement : règles de découpe/).closest('.rounded-tile');
    expect(card?.textContent).toContain('jamais seul');
    if (!card) throw new Error('no card around the choking rules');
    expect(card.classList.contains('bg-reaction-inconfort/5')).toBe(true);
    expectPairedForeground(card);
  });
});
