// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import FabLog from './FabLog.svelte';

afterEach(() => cleanup());

describe('FabLog', () => {
  it('renders a button with the expected aria-label', () => {
    render(FabLog, { props: { onclick: () => {} } });
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Enregistrer un aliment');
  });

  it('fires onclick when pressed', async () => {
    const onclick = vi.fn();
    render(FabLog, { props: { onclick } });
    await fireEvent.click(screen.getByRole('button'));
    expect(onclick).toHaveBeenCalled();
  });
});
