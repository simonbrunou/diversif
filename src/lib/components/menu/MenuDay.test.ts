import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import MenuDay from './MenuDay.svelte';
import { QUANTITIES } from '$lib/content/quantities';
import type { Menu } from '$lib/server/menu/engine';
import type { Food } from '$lib/server/db/schema';

afterEach(() => cleanup());

function makeFood(over: Partial<Food> = {}): Food {
  return {
    id: 1,
    name: 'Carotte',
    category: 'legumes',
    isMajorAllergen: false,
    allergenType: null,
    suggestedAgeMonths: 4,
    notes: null,
    isCustom: false,
    customForChildId: null,
    ...over
  };
}

// One introduced item (Carotte, isNew: false), one novelty item (Poulet,
// isNew: true), a non-empty discoverRoles (féculent still "à découvrir"),
// and a set allergenFocus (Œuf, mode 'introduce') — enough to exercise every
// MenuDay branch in a single render.
function makeMenu(): Menu {
  const carotte = makeFood({ id: 1, name: 'Carotte', category: 'legumes' });
  const poulet = makeFood({ id: 2, name: 'Poulet', category: 'viandes', suggestedAgeMonths: 6 });
  const oeuf = makeFood({
    id: 3,
    name: 'Œuf',
    category: 'oeufs',
    allergenType: 'oeuf',
    isMajorAllergen: true,
    suggestedAgeMonths: 6
  });

  return {
    stageId: '6-9',
    quantities: QUANTITIES['6-9'],
    textures: 'Purée grumeleuse',
    redFlags: [],
    noveltyFoodId: poulet.id,
    allergenFocus: { food: oeuf, mode: 'introduce' },
    meals: [
      {
        id: 'midi',
        label: 'Carotte · Poulet',
        items: [
          {
            role: 'legume',
            food: carotte,
            amountHint: '~130 g',
            texture: 'Purée grumeleuse',
            caution: null,
            isNew: false,
            allergenType: null
          },
          {
            role: 'proteine',
            food: poulet,
            amountHint: null,
            texture: 'Purée grumeleuse',
            caution: 'Haché ou petits morceaux fondants.',
            isNew: true,
            allergenType: null
          }
        ],
        discoverRoles: ['feculent']
      }
    ]
  };
}

describe('MenuDay', () => {
  it('renders the novelty badge, the à-découvrir prompt, and the allergène-du-jour card', () => {
    render(MenuDay, { props: { menu: makeMenu(), childId: 7 } });

    // Novelty: badge + its one-time hint, attached to the badged item (Poulet).
    expect(screen.getByText('Nouveauté')).toBeTruthy();
    expect(screen.getByText('Une nouveauté à la fois, en début de repas.')).toBeTruthy();

    // à-découvrir: one line per meal.discoverRoles entry, role label resolved.
    expect(screen.getByText(/À découvrir : un Féculent/)).toBeTruthy();

    // Allergène du jour card, sourced from menu.allergenFocus.
    expect(screen.getByText('Allergène du jour')).toBeTruthy();
    expect(screen.getByText('Œuf')).toBeTruthy();

    // The already-introduced item renders too, without a novelty badge.
    expect(screen.getByText('Carotte')).toBeTruthy();
  });
});
