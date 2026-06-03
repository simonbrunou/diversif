import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import RecentFeed from './RecentFeed.svelte';
import * as m from '$lib/paraglide/messages';

afterEach(() => cleanup());

describe('RecentFeed', () => {
  const entries = [
    {
      id: 1,
      foodId: 10,
      foodName: 'Poire',
      category: 'fruits' as const,
      reaction: 'ras' as const,
      givenAt: Date.now() - 1000,
      texture: null
    },
    {
      id: 2,
      foodId: 11,
      foodName: 'Banane',
      category: 'fruits' as const,
      reaction: 'ras' as const,
      givenAt: Date.now() - 2000,
      texture: null
    }
  ];

  it('renders the section header', () => {
    render(RecentFeed, { props: { entries, childId: '5' } });
    expect(screen.getByText('Cette semaine')).toBeTruthy();
  });

  it('renders one row per entry, capped at 5', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      foodId: i,
      foodName: `Food ${i}`,
      category: 'fruits' as const,
      reaction: 'ras' as const,
      givenAt: Date.now() - i * 1000,
      texture: null
    }));
    render(RecentFeed, { props: { entries: many, childId: '5' } });
    expect(screen.getAllByRole('listitem').length).toBe(5);
  });

  it('renders the empty placeholder when entries is empty', () => {
    render(RecentFeed, { props: { entries: [], childId: '5' } });
    expect(screen.getByText('Rien cette semaine')).toBeTruthy();
  });

  it('renders the reaction pill text', () => {
    render(RecentFeed, { props: { entries, childId: '5' } });
    expect(screen.getAllByText('OK').length).toBeGreaterThan(0);
  });

  it('wraps every entry in a link to the food entry detail page', () => {
    const mixed = [
      {
        id: 99,
        foodId: 20,
        foodName: 'Arachide',
        category: 'proteines' as const,
        reaction: 'reaction' as const,
        givenAt: Date.now() - 3000,
        texture: null
      },
      {
        id: 100,
        foodId: 21,
        foodName: 'Œuf',
        category: 'oeufs' as const,
        reaction: 'inconfort' as const,
        givenAt: Date.now() - 4000,
        texture: null
      }
    ];
    const { container } = render(RecentFeed, { props: { entries: mixed, childId: '7' } });
    const links = container.querySelectorAll('a');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('/child/7/foods/99');
    expect(links[1].getAttribute('href')).toBe('/child/7/foods/100');
  });

  it('also wraps RAS entries in a link (late-reaction reachable)', () => {
    const { container } = render(RecentFeed, { props: { entries, childId: '5' } });
    const links = container.querySelectorAll('a');
    expect(links.length).toBe(2);
    expect(links[0].getAttribute('href')).toBe('/child/5/foods/1');
    expect(links[1].getAttribute('href')).toBe('/child/5/foods/2');
  });

  it('shows the texture chip when texture is set, hides it when null', () => {
    const withTexture = [
      {
        id: 3,
        foodId: 12,
        foodName: 'Carotte',
        category: 'legumes' as const,
        reaction: 'ras' as const,
        givenAt: Date.now() - 1000,
        texture: 'ecrasee' as const
      },
      {
        id: 4,
        foodId: 13,
        foodName: 'Pomme',
        category: 'fruits' as const,
        reaction: 'ras' as const,
        givenAt: Date.now() - 2000,
        texture: null
      }
    ];
    render(RecentFeed, { props: { entries: withTexture, childId: '5' } });
    expect(screen.getByText(new RegExp(m.textureEcrasee(), 'i'))).toBeTruthy();
    expect(screen.queryByText(new RegExp(m.textureLisse(), 'i'))).toBeNull();
  });
});
