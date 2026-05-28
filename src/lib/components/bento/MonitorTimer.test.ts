import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import MonitorTimer from './MonitorTimer.svelte';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('MonitorTimer', () => {
  it('renders the start CTA when not started', () => {
    render(MonitorTimer, { props: { entryId: 'e-1' } });
    expect(screen.getByRole('button', { name: /Suivre 30 min/ })).toBeTruthy();
  });

  it('starts the timer and shows surveillance state when tapped', async () => {
    render(MonitorTimer, { props: { entryId: 'e-1' } });
    await fireEvent.click(screen.getByRole('button', { name: /Suivre 30 min/ }));
    expect(screen.getByText(/Surveillance/)).toBeTruthy();
  });

  it('restores state from localStorage on mount', () => {
    localStorage.setItem('monitor-timer:e-1', JSON.stringify({ startedAt: Date.now() - 5_000 }));
    render(MonitorTimer, { props: { entryId: 'e-1' } });
    expect(screen.getByText(/Surveillance/)).toBeTruthy();
  });

  it('shows the done message when 30 min have elapsed', () => {
    localStorage.setItem(
      'monitor-timer:e-1',
      JSON.stringify({ startedAt: Date.now() - 31 * 60 * 1000 })
    );
    render(MonitorTimer, { props: { entryId: 'e-1' } });
    expect(screen.getByText(/30 min écoulées/)).toBeTruthy();
  });
});
