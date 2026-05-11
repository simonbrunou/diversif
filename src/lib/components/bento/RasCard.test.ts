// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import RasCard from './RasCard.svelte';

afterEach(() => cleanup());

describe('RasCard', () => {
  it('renders the RAS message with Nth exposition', () => {
    render(RasCard, { props: { nth: 3 } });
    expect(screen.getByText(/3 exposition/)).toBeTruthy();
  });
});
