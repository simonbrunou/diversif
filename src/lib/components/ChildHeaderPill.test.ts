// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import ChildHeaderPill from './ChildHeaderPill.svelte';

afterEach(() => cleanup());

describe('ChildHeaderPill', () => {
  const child = { id: 'abc', name: 'Léo', birthMonth: '2025-11-01', avatarSeed: '🌱' };

  it('renders the child name', () => {
    render(ChildHeaderPill, { props: { child, onSwitch: () => {} } });
    expect(screen.getByText('Léo')).toBeTruthy();
  });

  it('fires onSwitch when the chevron is tapped', async () => {
    const onSwitch = vi.fn();
    render(ChildHeaderPill, { props: { child, onSwitch } });
    await fireEvent.click(screen.getByRole('button'));
    expect(onSwitch).toHaveBeenCalled();
  });
});
