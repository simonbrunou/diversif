// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import Command from './Command.svelte';

afterEach(() => cleanup());

describe('Command', () => {
  const items = [
    { value: 'pear', label: 'Poire' },
    { value: 'apple', label: 'Pomme' },
    { value: 'banana', label: 'Banane' }
  ];

  it('renders all items initially', () => {
    render(Command, { props: { items, placeholder: '🔍 chercher' } });
    expect(screen.getByText('Poire')).toBeTruthy();
    expect(screen.getByText('Pomme')).toBeTruthy();
    expect(screen.getByText('Banane')).toBeTruthy();
  });

  it('filters items as the user types', async () => {
    render(Command, { props: { items, placeholder: '🔍' } });
    const input = screen.getByPlaceholderText('🔍') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'po' } });
    expect(screen.getByText('Poire')).toBeTruthy();
    expect(screen.getByText('Pomme')).toBeTruthy();
    expect(screen.queryByText('Banane')).toBeNull();
  });

  it('shows the empty state when no item matches', async () => {
    render(Command, { props: { items, placeholder: '🔍', emptyLabel: 'rien trouvé' } });
    const input = screen.getByPlaceholderText('🔍') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'xyz' } });
    expect(screen.getByText('rien trouvé')).toBeTruthy();
  });
});
