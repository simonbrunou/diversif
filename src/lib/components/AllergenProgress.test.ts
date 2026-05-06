// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../test/component';
import AllergenProgress from './AllergenProgress.svelte';

describe('AllergenProgress', () => {
  it('renders the X / Y count', () => {
    const { container } = render(AllergenProgress, {
      props: { summary: { introduced: 3, total: 12, ras: 2, inconfort: 1, reaction: 0 } }
    });
    expect(container.textContent).toContain('3 / 12');
  });

  it('shows segments for each non-zero reaction band with non-color patterns', () => {
    const { container } = render(AllergenProgress, {
      props: { summary: { introduced: 5, total: 12, ras: 3, inconfort: 1, reaction: 1 } }
    });
    // Each segment should carry a CSS pattern via background-image so
    // colorblind users can still tell the bands apart on the bar itself.
    const patterns = Array.from(
      container.querySelectorAll<HTMLDivElement>(
        '.bg-reaction-ras, .bg-reaction-inconfort, .bg-reaction-reaction'
      )
    );
    expect(patterns.length).toBe(3);
    for (const el of patterns) {
      expect(el.getAttribute('style') ?? '').toContain('background-image');
    }
  });

  it('renders the legend with text labels (not just colored dots)', () => {
    const { container } = render(AllergenProgress, {
      props: { summary: { introduced: 5, total: 12, ras: 3, inconfort: 1, reaction: 1 } }
    });
    expect(container.textContent).toContain('Bien toléré');
    expect(container.textContent).toContain('Petit inconfort');
    expect(container.textContent).toContain('Réaction marquée');
  });

  it('hides legend rows when their count is zero', () => {
    const { container } = render(AllergenProgress, {
      props: { summary: { introduced: 3, total: 12, ras: 3, inconfort: 0, reaction: 0 } }
    });
    expect(container.textContent).toContain('Bien toléré');
    expect(container.textContent).not.toContain('Petit inconfort');
    expect(container.textContent).not.toContain('Réaction marquée');
  });

  it('shows "À tester" for the remaining count', () => {
    const { container } = render(AllergenProgress, {
      props: { summary: { introduced: 4, total: 12, ras: 4, inconfort: 0, reaction: 0 } }
    });
    expect(container.textContent).toContain('À tester');
    expect(container.textContent).toContain('8');
  });

  it('handles total=0 without dividing by zero', () => {
    const { container } = render(AllergenProgress, {
      props: { summary: { introduced: 0, total: 0, ras: 0, inconfort: 0, reaction: 0 } }
    });
    expect(container.textContent).toContain('0 / 0');
  });

  it('exposes a descriptive aria-label that includes the breakdown', () => {
    const { container } = render(AllergenProgress, {
      props: { summary: { introduced: 5, total: 12, ras: 3, inconfort: 2, reaction: 0 } }
    });
    const labelled = container.querySelector('[role="img"]');
    const label = labelled?.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/5.*12/);
    expect(label.toLowerCase()).toContain('bien tolérés');
    expect(label.toLowerCase()).toContain('inconfort');
  });

  it('marks the decorative bar aria-hidden so screen readers do not double-announce', () => {
    const { container } = render(AllergenProgress, {
      props: { summary: { introduced: 3, total: 12, ras: 2, inconfort: 1, reaction: 0 } }
    });
    const bar = container.querySelector('.h-2\\.5');
    expect(bar?.getAttribute('aria-hidden')).toBe('true');
  });
});
