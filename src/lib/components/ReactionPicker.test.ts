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
    expect(container.textContent).toContain('RAS');
    expect(container.textContent).toContain('Inconfort');
    expect(container.textContent).toContain('Réaction');
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
});
