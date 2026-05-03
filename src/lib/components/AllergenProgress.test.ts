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

  it('shows segments for each non-zero reaction band', () => {
    const { container } = render(AllergenProgress, {
      props: { summary: { introduced: 5, total: 12, ras: 3, inconfort: 1, reaction: 1 } }
    });
    expect(container.querySelector('[title="RAS"]')).not.toBeNull();
    expect(container.querySelector('[title="Inconfort"]')).not.toBeNull();
    expect(container.querySelector('[title="Réaction"]')).not.toBeNull();
  });

  it('hides segments when their count is zero', () => {
    const { container } = render(AllergenProgress, {
      props: { summary: { introduced: 3, total: 12, ras: 3, inconfort: 0, reaction: 0 } }
    });
    expect(container.querySelector('[title="RAS"]')).not.toBeNull();
    expect(container.querySelector('[title="Inconfort"]')).toBeNull();
    expect(container.querySelector('[title="Réaction"]')).toBeNull();
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

  it('exposes accessible label', () => {
    const { container } = render(AllergenProgress, {
      props: { summary: { introduced: 5, total: 12, ras: 3, inconfort: 2, reaction: 0 } }
    });
    const labelled = container.querySelector('[role="img"]');
    expect(labelled?.getAttribute('aria-label')).toMatch(/5.*12/);
  });
});
