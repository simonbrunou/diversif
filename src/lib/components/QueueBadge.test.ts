// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import QueueBadge from './QueueBadge.svelte';

// vi.hoisted runs before imports are resolved, so we build a minimal
// readable-store substitute without depending on svelte/store.
const countStore = vi.hoisted(() => {
  let _value = 0;
  const subscribers = new Set<(v: number) => void>();
  return {
    subscribe(fn: (v: number) => void) {
      fn(_value);
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    set(v: number) {
      _value = v;
      subscribers.forEach((fn) => fn(v));
    }
  };
});

vi.mock('$lib/offline/queue', () => ({
  pendingCount: { subscribe: countStore.subscribe }
}));

afterEach(() => cleanup());

describe('QueueBadge', () => {
  it('renders nothing when count is 0', () => {
    countStore.set(0);
    render(QueueBadge);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders the count when > 0', () => {
    countStore.set(2);
    render(QueueBadge);
    expect(screen.getByRole('status').textContent?.trim()).toBe('2 à synchroniser');
  });
});
