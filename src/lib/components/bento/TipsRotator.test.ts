// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import TipsRotator from './TipsRotator.svelte';

afterEach(() => cleanup());

describe('TipsRotator', () => {
  const tip = {
    id: 'tip-allergen-eggs',
    title: "Introduire l'œuf tôt",
    body: "Selon LEAP, introduire l'œuf entre 4 et 11 mois réduit le risque d'allergie."
  };

  it('renders the tip title and body when not dismissed', () => {
    render(TipsRotator, { props: { tip, dismissed: false, onDismiss: () => {} } });
    expect(screen.getByText("Introduire l'œuf tôt")).toBeTruthy();
    expect(screen.getByText(/LEAP/)).toBeTruthy();
  });

  it('renders nothing when dismissed=true', () => {
    const { container } = render(TipsRotator, {
      props: { tip, dismissed: true, onDismiss: () => {} }
    });
    expect(container.querySelector('section')).toBeNull();
  });

  it('renders nothing when tip is null', () => {
    const { container } = render(TipsRotator, {
      props: { tip: null, dismissed: false, onDismiss: () => {} }
    });
    expect(container.querySelector('section')).toBeNull();
  });

  it('calls onDismiss with the tip id when dismiss is tapped', async () => {
    const onDismiss = vi.fn();
    render(TipsRotator, { props: { tip, dismissed: false, onDismiss } });
    await fireEvent.click(screen.getByRole('button', { name: 'Masquer' }));
    expect(onDismiss).toHaveBeenCalledWith('tip-allergen-eggs');
  });
});
