import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import ChildSwitcherDrawer from './ChildSwitcherDrawer.svelte';

afterEach(async () => {
  cleanup();
  // bits-ui releases its body-scroll lock on a short timeout. Let that cleanup
  // run while happy-dom's document still exists so it cannot fire after the
  // test environment has been torn down.
  await new Promise((resolve) => setTimeout(resolve, 50));
});

describe('ChildSwitcherDrawer', () => {
  const kids = [
    { id: 'a', name: 'Léo', birthMonth: '2025-11-01', avatarSeed: '🌱' },
    { id: 'b', name: 'Mia', birthMonth: '2024-04-01', avatarSeed: '🐝' }
  ];

  it('renders child names when open', () => {
    render(ChildSwitcherDrawer, {
      props: { open: true, kids, currentChildId: 'a' }
    });
    expect(screen.getByText('Léo')).toBeTruthy();
    expect(screen.getByText('Mia')).toBeTruthy();
  });

  it('renders an Add child link when open', () => {
    render(ChildSwitcherDrawer, {
      props: { open: true, kids, currentChildId: 'a' }
    });
    const add = screen.getByText(/Ajouter/);
    expect(add.closest('a')!.getAttribute('href')).toBe('/child/new');
  });

  it('hides everything when not open', () => {
    render(ChildSwitcherDrawer, {
      props: { open: false, kids, currentChildId: 'a' }
    });
    expect(screen.queryByText('Léo')).toBeNull();
  });
});
