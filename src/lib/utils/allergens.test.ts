import { describe, it, expect } from 'vitest';
import { ALLERGENS, getAllergenLabel } from './allergens';

describe('ALLERGENS', () => {
  it('exposes a non-empty list with unique ids', () => {
    expect(ALLERGENS.length).toBeGreaterThan(0);
    const ids = ALLERGENS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The literal "12" appears in static SEO copy, page titles, article bodies,
  // toasts, FAQ answers and paraglide messages. If you grow or shrink
  // ALLERGENS, this test fails first : sweep these consumers before updating
  // the expected count:
  //   - src/lib/seo.ts (description meta)
  //   - src/lib/components/landing/LandingFeatures.svelte
  //   - src/lib/components/GuideStaticSections.svelte
  //   - src/routes/+page.svelte (landing FAQ + chip nav)
  //   - src/routes/allergens/+page.svelte (h1, ItemList name, body copy)
  //   - src/routes/guide/+page.svelte (Seo + Article description)
  //   - src/routes/child/[id]/log/+page.server.ts (comment)
  //   - src/routes/child/[id]/log/page.server.test.ts (comment)
  //   - src/lib/utils/milestones.test.ts (toast assertion)
  //   - messages/fr.json + messages/en.json (dialogsWelcomeStep1Bullet2After
  //     and dashboardNavAllergensDescription both reference the count)
  // Programmatic call sites (milestones.ts toast) already interpolate
  // ALLERGENS.length and don't need a manual update.
  it('matches the "12" hardcoded in user-facing copy', () => {
    expect(ALLERGENS).toHaveLength(12);
  });
});

describe('getAllergenLabel', () => {
  it('returns the label for a known id', () => {
    expect(getAllergenLabel('gluten')).toBe('Gluten');
    expect(getAllergenLabel('oeuf')).toBe('Œuf');
  });

  it('returns null for unknown id', () => {
    expect(getAllergenLabel('not-a-real-allergen')).toBeNull();
  });

  it('returns null for null / undefined / empty input', () => {
    expect(getAllergenLabel(null)).toBeNull();
    expect(getAllergenLabel(undefined)).toBeNull();
    expect(getAllergenLabel('')).toBeNull();
  });
});
