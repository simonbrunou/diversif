import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import FabLog from './FabLog.svelte';
import * as m from '$lib/paraglide/messages';

afterEach(() => cleanup());

describe('FabLog', () => {
  it('names the button with the full log action, not the short caption', () => {
    render(FabLog, { props: { onclick: () => {} } });
    // The visible caption is an aria-hidden sibling, so the accessible name
    // comes from the aria-label alone — a co-parent on a screen reader hears
    // the whole action, not just "Enregistrer".
    expect(screen.getByRole('button', { name: m.chromeFabLog() })).toBeTruthy();
  });

  it('shows a visible caption so the primary action is not an unlabelled circle', () => {
    render(FabLog, { props: { onclick: () => {} } });
    expect(screen.getByText(m.chromeFabLogShort())).toBeTruthy();
  });

  it('fires onclick when pressed', async () => {
    const onclick = mock();
    render(FabLog, { props: { onclick } });
    await fireEvent.click(screen.getByRole('button'));
    expect(onclick).toHaveBeenCalled();
  });
});
