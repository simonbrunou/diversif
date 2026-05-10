// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import LogSheet from './LogSheet.svelte';

vi.mock('$app/forms', () => ({
  enhance: () => ({ destroy: () => {} })
}));

afterEach(() => cleanup());

describe('LogSheet', () => {
  const props = {
    open: true,
    childId: 'abc',
    childName: 'Léo',
    foods: [
      { id: 'pear', label: 'Poire' },
      { id: 'banana', label: 'Banane' }
    ]
  };

  it('renders the title with the child name when open', () => {
    render(LogSheet, { props });
    expect(screen.getByText(/Léo/)).toBeTruthy();
  });

  it('renders the food list', () => {
    render(LogSheet, { props });
    expect(screen.getByText('Poire')).toBeTruthy();
    expect(screen.getByText('Banane')).toBeTruthy();
  });

  it('hides when not open', () => {
    render(LogSheet, { props: { ...props, open: false } });
    expect(screen.queryByText('Poire')).toBeNull();
  });

  it('exposes a form posting to /child/{id}/log', () => {
    render(LogSheet, { props });
    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    expect(form!.getAttribute('action')).toMatch(/\/child\/abc\/log/);
    expect(form!.getAttribute('method')).toMatch(/post/i);
  });
});
