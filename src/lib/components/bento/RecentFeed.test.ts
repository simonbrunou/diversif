import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import RecentFeed from './RecentFeed.svelte';
import * as m from '$lib/paraglide/messages';
import type { RecentEntry } from '$lib/types';

afterEach(() => cleanup());

describe('RecentFeed', () => {
  const entries: RecentEntry[] = [
    {
      id: 1,
      foodId: 10,
      foodName: 'Poire',
      category: 'fruits' as const,
      reaction: 'ras' as const,
      givenAt: Date.now() - 1000,
      texture: null,
      mealId: null
    },
    {
      id: 2,
      foodId: 11,
      foodName: 'Banane',
      category: 'fruits' as const,
      reaction: 'ras' as const,
      givenAt: Date.now() - 2000,
      texture: null,
      mealId: null
    }
  ];

  it('renders the section header', () => {
    render(RecentFeed, { props: { entries, childId: '5' } });
    expect(screen.getByText('Cette semaine')).toBeTruthy();
  });

  it('renders one row per entry, capped at 5', () => {
    const many: RecentEntry[] = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      foodId: i,
      foodName: `Food ${i}`,
      category: 'fruits' as const,
      reaction: 'ras' as const,
      givenAt: Date.now() - i * 1000,
      texture: null,
      mealId: null
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
    const mixed: RecentEntry[] = [
      {
        id: 99,
        foodId: 20,
        foodName: 'Arachide',
        category: 'proteines' as const,
        reaction: 'reaction' as const,
        givenAt: Date.now() - 3000,
        texture: null,
        mealId: null
      },
      {
        id: 100,
        foodId: 21,
        foodName: 'Œuf',
        category: 'oeufs' as const,
        reaction: 'inconfort' as const,
        givenAt: Date.now() - 4000,
        texture: null,
        mealId: null
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
    const withTexture: RecentEntry[] = [
      {
        id: 3,
        foodId: 12,
        foodName: 'Carotte',
        category: 'legumes' as const,
        reaction: 'ras' as const,
        givenAt: Date.now() - 1000,
        texture: 'ecrasee' as const,
        mealId: null
      },
      {
        id: 4,
        foodId: 13,
        foodName: 'Pomme',
        category: 'fruits' as const,
        reaction: 'ras' as const,
        givenAt: Date.now() - 2000,
        texture: null,
        mealId: null
      }
    ];
    render(RecentFeed, { props: { entries: withTexture, childId: '5' } });
    expect(screen.getByText(new RegExp(m.textureEcrasee(), 'i'))).toBeTruthy();
    expect(screen.queryByText(new RegExp(m.textureLisse(), 'i'))).toBeNull();
  });

  it('groups a multi-ingredient meal into one card with a worst-of badge linking to the meal editor', () => {
    // Three ingredients sharing a mealId, contiguous (as the loader's
    // givenAt-desc/id-asc ordering guarantees) — ras/inconfort/reaction should
    // fold into ONE card whose badge shows the worst of the three: 'reaction'.
    const meal: RecentEntry[] = [
      {
        id: 1,
        foodId: 1,
        foodName: 'Carotte',
        category: 'legumes' as const,
        reaction: 'ras' as const,
        givenAt: Date.now(),
        texture: null,
        mealId: 'meal-1'
      },
      {
        id: 2,
        foodId: 2,
        foodName: 'Poire',
        category: 'fruits' as const,
        reaction: 'inconfort' as const,
        givenAt: Date.now(),
        texture: null,
        mealId: 'meal-1'
      },
      {
        id: 3,
        foodId: 3,
        foodName: 'Poulet',
        category: 'proteines' as const,
        reaction: 'reaction' as const,
        givenAt: Date.now(),
        texture: null,
        mealId: 'meal-1'
      }
    ];
    const singleton: RecentEntry = {
      id: 4,
      foodId: 4,
      foodName: 'Pomme',
      category: 'fruits' as const,
      reaction: 'ras' as const,
      givenAt: Date.now() - 5000,
      texture: null,
      mealId: null
    };
    const { container } = render(RecentFeed, {
      props: { entries: [...meal, singleton], childId: '9' }
    });

    // One card for the whole meal (2 listitems total: the meal + the
    // singleton), not one row per ingredient (which would be 4).
    expect(screen.getAllByRole('listitem').length).toBe(2);

    // The three ingredient names are joined inside a single text node — this
    // could only render this way from one shared card, never from 3 rows.
    expect(screen.getByText('Carotte, Poire, Poulet')).toBeTruthy();

    // Worst-of badge reuses the existing reaction pill: ras + inconfort +
    // reaction -> 'reaction' wins, rendered with the same label as a normal row.
    expect(screen.getByText(m.reactionsLabelReaction())).toBeTruthy();

    const links = container.querySelectorAll('a');
    expect(links.length).toBe(2);
    // Meal card links to the first member's meal editor, flagged from the
    // dashboard so the editor's back-link returns here.
    expect(links[0].getAttribute('href')).toBe('/child/9/log/1?from=dashboard');
    // The singleton is unaffected: same food-entry-detail link as before.
    expect(screen.getByText('Pomme')).toBeTruthy();
    expect(links[1].getAttribute('href')).toBe('/child/9/foods/4');
  });

  it('caps the feed at 5 GROUPS, not 5 rows — a meal counts as one group toward the cap', () => {
    const now = Date.now();
    // 1 meal of 3 ingredients (most recent) + 6 singletons older than it, all
    // pre-sorted givenAt desc as the loader would produce: 9 rows, 7 groups.
    const meal: RecentEntry[] = [
      {
        id: 1,
        foodId: 1,
        foodName: 'Carotte',
        category: 'legumes' as const,
        reaction: 'ras' as const,
        givenAt: now,
        texture: null,
        mealId: 'meal-1'
      },
      {
        id: 2,
        foodId: 2,
        foodName: 'Poire',
        category: 'fruits' as const,
        reaction: 'ras' as const,
        givenAt: now,
        texture: null,
        mealId: 'meal-1'
      },
      {
        id: 3,
        foodId: 3,
        foodName: 'Poulet',
        category: 'proteines' as const,
        reaction: 'ras' as const,
        givenAt: now,
        texture: null,
        mealId: 'meal-1'
      }
    ];
    const singles: RecentEntry[] = Array.from({ length: 6 }, (_, i) => ({
      id: 10 + i,
      foodId: 10 + i,
      foodName: `Single ${i}`,
      category: 'fruits' as const,
      reaction: 'ras' as const,
      givenAt: now - (i + 1) * 1000,
      texture: null,
      mealId: null
    }));
    render(RecentFeed, { props: { entries: [...meal, ...singles], childId: '5' } });

    // Capped at 5 GROUPS: the meal (1 group / 3 rows) + the first 4 singles.
    // A row-based slice(0, 5) would instead grab the meal's 3 rows plus only
    // Single 0 and Single 1 — so Single 2 / Single 3 being visible is the
    // tell that the cap counts groups, not rows.
    expect(screen.getAllByRole('listitem').length).toBe(5);
    expect(screen.getByText('Single 0')).toBeTruthy();
    expect(screen.getByText('Single 1')).toBeTruthy();
    expect(screen.getByText('Single 2')).toBeTruthy();
    expect(screen.getByText('Single 3')).toBeTruthy();
    expect(screen.queryByText('Single 4')).toBeNull();
    expect(screen.queryByText('Single 5')).toBeNull();
  });
});
