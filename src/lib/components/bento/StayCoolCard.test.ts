import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import StayCoolCard from './StayCoolCard.svelte';

afterEach(() => cleanup());

describe('StayCoolCard', () => {
  it('renders title, body, and reactions guide link to /guide#reactions', () => {
    render(StayCoolCard);
    expect(screen.getByText('Respirez')).toBeTruthy();
    expect(screen.getByText(/Une réaction localisée/)).toBeTruthy();
    const link = screen.getByText('Voir le guide réactions').closest('a');
    expect(link?.getAttribute('href')).toBe('/guide#reactions');
  });
});
