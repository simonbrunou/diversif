// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import '../../test/component';
import ReactionPicker from './ReactionPicker.svelte';

describe('ReactionPicker', () => {
  it('renders 3 radio inputs', () => {
    const { container } = render(ReactionPicker, { props: { name: 'r' } });
    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBe(3);
  });

  it('shows the labels', () => {
    const { container } = render(ReactionPicker, { props: { name: 'r' } });
    expect(container.textContent).toContain('Tout va bien');
    expect(container.textContent).toContain('Petit inconfort');
    expect(container.textContent).toContain('Réaction marquée');
  });

  it('selects the default value (ras)', () => {
    const { container } = render(ReactionPicker, { props: { name: 'r' } });
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="radio"]'));
    expect(radios.find((r) => r.value === 'ras')?.checked).toBe(true);
  });

  it('updates value when a different option is clicked', async () => {
    const { container } = render(ReactionPicker, { props: { name: 'r' } });
    const inconfort = container.querySelector<HTMLInputElement>('input[value="inconfort"]')!;
    await fireEvent.click(inconfort);
    expect(inconfort.checked).toBe(true);
  });

  it('honors a non-default initial value', () => {
    const { container } = render(ReactionPicker, {
      props: { name: 'r', value: 'reaction' }
    });
    const reaction = container.querySelector<HTMLInputElement>('input[value="reaction"]')!;
    expect(reaction.checked).toBe(true);
  });

  it('paints a visible focus ring on every option (not only the active one)', () => {
    const { container } = render(ReactionPicker, { props: { name: 'r' } });
    const labels = Array.from(container.querySelectorAll('label'));
    expect(labels.length).toBe(3);
    for (const label of labels) {
      const cls = label.className;
      // has-[:focus-visible] paints a primary ring on keyboard focus regardless of selection state
      expect(cls).toContain('has-[:focus-visible]:ring-2');
      expect(cls).toContain('has-[:focus-visible]:ring-ring');
    }
  });

  it('shows a non-color check badge on the active option (so selection is not color-only)', () => {
    const { container } = render(ReactionPicker, {
      props: { name: 'r', value: 'inconfort' }
    });
    // The active label's icon area is augmented with a check; we look for an
    // svg whose stroke-width is 3 (the heavier check we draw to make it pop).
    const heavyCheck = container.querySelector('svg[stroke-width="3"]');
    expect(heavyCheck).not.toBeNull();
  });
});
