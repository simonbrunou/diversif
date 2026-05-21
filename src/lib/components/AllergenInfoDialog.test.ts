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
    render(AllergenInfoDialog, { props: { allergenId: 'oeuf' } });
    expect(document.body.textContent).toMatch(/Œuf/);
    expect(screen.getByText(/Pourquoi tôt/)).toBeTruthy();
    expect(screen.getByText(/Comment l’introduire/)).toBeTruthy();
    expect(screen.getByText(/Premiers signes/)).toBeTruthy();
    expect(screen.getByText(/Sources/)).toBeTruthy();
  });

  it('wraps the dialog body in a scroll container so mobile bottom-sheet content cannot clip', () => {
    // Without the max-h-[70vh] + overflow-y-auto wrapper, the why /
    // how-to-offer / first-signs / severe-signs / sources stack overflows the
    // 92dvh sheet height with no way to reach the bottom — content (and the
    // close button) become unreachable. The same pattern is used by
    // StageDetailSheet.
    render(AllergenInfoDialog, { props: { allergenId: 'oeuf' } });
    const scroller = document.querySelector('[role="dialog"] .max-h-\\[70vh\\].overflow-y-auto');
    expect(scroller).toBeTruthy();
  });

  it('calls onclose when the Fermer button is clicked', async () => {
    const onclose = vi.fn();
    render(AllergenInfoDialog, { props: { allergenId: 'oeuf', onclose } });
    await fireEvent.click(screen.getByText('Fermer'));
    expect(onclose).toHaveBeenCalled();
  });

  // Escape-to-close is covered by bits-ui's own test suite; the dialog now
  // wraps bits-ui DialogPrimitive whose escape handler doesn't surface through
  // happy-dom's keydown synthesis. Click-on-Fermer (the test above) is the
  // representative close path.
});
