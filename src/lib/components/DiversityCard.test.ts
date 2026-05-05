// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../test/component';
import DiversityCard from './DiversityCard.svelte';

const DAY = 86400_000;

describe('DiversityCard', () => {
  it('shows "—" for lastNew when null', () => {
    const { container } = render(DiversityCard, {
      props: {
        metrics: {
          categoriesCovered: 4,
          totalCategories: 11,
          lastNewFoodAt: null,
          repeatExposureCount: 2
        }
      }
    });
    expect(container.textContent).toContain('—');
    expect(container.textContent).toContain('4');
    expect(container.textContent).toContain('11');
    expect(container.textContent).toContain('2');
  });

  it('shows "aujourd\'hui" when lastNew is today', () => {
    const { container } = render(DiversityCard, {
      props: {
        metrics: {
          categoriesCovered: 1,
          totalCategories: 11,
          lastNewFoodAt: Date.now() - 1000,
          repeatExposureCount: 0
        }
      }
    });
    expect(container.textContent).toContain("aujourd'hui");
  });

  it('shows "hier" when lastNew is 1 day ago', () => {
    const { container } = render(DiversityCard, {
      props: {
        metrics: {
          categoriesCovered: 1,
          totalCategories: 11,
          lastNewFoodAt: Date.now() - DAY - 1000,
          repeatExposureCount: 0
        }
      }
    });
    expect(container.textContent).toContain('hier');
  });

  it('shows "il y a N j" when lastNew is older', () => {
    const { container } = render(DiversityCard, {
      props: {
        metrics: {
          categoriesCovered: 1,
          totalCategories: 11,
          lastNewFoodAt: Date.now() - 5 * DAY,
          repeatExposureCount: 0
        }
      }
    });
    expect(container.textContent).toMatch(/il y a 5/);
  });

  it('celebrates when every category is covered', () => {
    const { container } = render(DiversityCard, {
      props: {
        metrics: {
          categoriesCovered: 11,
          totalCategories: 11,
          lastNewFoodAt: Date.now() - DAY,
          repeatExposureCount: 0
        }
      }
    });
    expect(container.textContent).toContain('Toutes les familles couvertes');
  });

  it('nudges when most categories are covered but not all', () => {
    const { container } = render(DiversityCard, {
      props: {
        metrics: {
          categoriesCovered: 9,
          totalCategories: 11,
          lastNewFoodAt: Date.now() - DAY,
          repeatExposureCount: 0
        }
      }
    });
    expect(container.textContent).toContain('Plus que 2 groupes');
  });
});
