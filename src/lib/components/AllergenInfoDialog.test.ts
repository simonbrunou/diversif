// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import '../../test/component';
import AllergenInfoDialog from './AllergenInfoDialog.svelte';

describe('AllergenInfoDialog', () => {
  it('does not render when allergenId is null', () => {
    const { container } = render(AllergenInfoDialog, { props: { allergenId: null } });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the guidance for a known allergen', () => {
    const { container } = render(AllergenInfoDialog, { props: { allergenId: 'oeuf' } });
    expect(container.textContent).toMatch(/Œuf/);
    expect(screen.getByText(/Pourquoi tôt/)).toBeTruthy();
    expect(screen.getByText(/Comment l'introduire/)).toBeTruthy();
    expect(screen.getByText(/Premiers signes/)).toBeTruthy();
    expect(screen.getByText(/Sources/)).toBeTruthy();
  });

  it('calls onclose when the Fermer button is clicked', async () => {
    const onclose = vi.fn();
    render(AllergenInfoDialog, { props: { allergenId: 'oeuf', onclose } });
    await fireEvent.click(screen.getByText('Fermer'));
    expect(onclose).toHaveBeenCalled();
  });

  it('closes via Escape key', async () => {
    const onclose = vi.fn();
    render(AllergenInfoDialog, { props: { allergenId: 'oeuf', onclose } });
    await fireEvent.keyDown(window, { key: 'Escape' });
    expect(onclose).toHaveBeenCalled();
  });
});
