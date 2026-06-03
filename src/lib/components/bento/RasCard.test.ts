import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import RasCard from './RasCard.svelte';

afterEach(() => cleanup());

describe('RasCard', () => {
  it('renders the RAS message with Nth exposition', () => {
    render(RasCard, { props: { nth: 3 } });
    expect(screen.getByText(/3 exposition/)).toBeTruthy();
  });
});
