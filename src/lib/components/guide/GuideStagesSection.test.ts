import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import GuideStagesSection from './GuideStagesSection.svelte';
import { STAGES } from '#lib/content/guidance.js';
import { expectPairedForeground } from '../../../test/paired-foreground';

afterEach(() => cleanup());

describe('GuideStagesSection', () => {
  it("sets each « À surveiller » box, eyebrow and list, in the inconfort tint's own foreground (#667)", () => {
    render(GuideStagesSection);
    const eyebrows = screen.getAllByText('À surveiller');
    expect(eyebrows).toHaveLength(STAGES.filter((s) => s.redFlags.length > 0).length);
    for (const eyebrow of eyebrows) {
      const box = eyebrow.parentElement;
      if (!box) throw new Error('no box around the eyebrow');
      expect(box.classList.contains('bg-reaction-inconfort/5')).toBe(true);
      expect(box.querySelectorAll('li').length).toBeGreaterThan(0);
      expectPairedForeground(box);
    }
  });
});
