import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import DidYouKnow from './DidYouKnow.svelte';
import type { FactCard } from '$lib/content/did-you-know';

afterEach(() => cleanup());

const SAMPLE: FactCard[] = [
  {
    id: 'one',
    title: 'Premier fait',
    body: 'Corps du premier fait.',
    sources: ['hcsp-2020']
  },
  {
    id: 'two',
    title: 'Deuxième fait',
    body: 'Corps du deuxième fait.',
    sources: ['leap-2015']
  },
  {
    id: 'three',
    title: 'Troisième fait',
    body: 'Corps du troisième fait.',
    sources: ['anses-nourrisson']
  }
];

describe('DidYouKnow', () => {
  it('renders the section header and first card by default', () => {
    render(DidYouKnow, { props: { cards: SAMPLE } });
    expect(screen.getByText('Le saviez-vous ?')).toBeTruthy();
    expect(screen.getByText('Premier fait')).toBeTruthy();
    expect(screen.getByText('Corps du premier fait.')).toBeTruthy();
  });

  it('renders position indicator "1 / 3"', () => {
    render(DidYouKnow, { props: { cards: SAMPLE } });
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('advances to the next card on Next click', async () => {
    render(DidYouKnow, { props: { cards: SAMPLE } });
    await fireEvent.click(screen.getByRole('button', { name: /Carte suivante/ }));
    expect(screen.getByText('Deuxième fait')).toBeTruthy();
    expect(screen.getByText('2 / 3')).toBeTruthy();
  });

  it('wraps around when advancing past the end', async () => {
    render(DidYouKnow, { props: { cards: SAMPLE } });
    const nextBtn = screen.getByRole('button', { name: /Carte suivante/ });
    await fireEvent.click(nextBtn);
    await fireEvent.click(nextBtn);
    await fireEvent.click(nextBtn);
    // wrapped back to first card
    expect(screen.getByText('Premier fait')).toBeTruthy();
  });

  it('goes back on Previous click', async () => {
    render(DidYouKnow, { props: { cards: SAMPLE } });
    await fireEvent.click(screen.getByRole('button', { name: /Carte précédente/ }));
    // wraps to the last card
    expect(screen.getByText('Troisième fait')).toBeTruthy();
  });

  it('hides the nav controls when there is only one card', () => {
    render(DidYouKnow, { props: { cards: [SAMPLE[0]] } });
    expect(screen.queryByRole('button', { name: /Carte suivante/ })).toBeNull();
    expect(screen.queryByText('1 / 1')).toBeNull();
  });

  it('renders nothing when cards is empty', () => {
    const { container } = render(DidYouKnow, { props: { cards: [] } });
    expect(container.querySelector('section')).toBeNull();
  });
});
