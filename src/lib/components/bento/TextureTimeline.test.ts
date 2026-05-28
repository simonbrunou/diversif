import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/svelte';
import TextureTimeline from './TextureTimeline.svelte';

afterEach(() => cleanup());

describe('TextureTimeline', () => {
  it('renders the section header and subtitle with current age + default texture', () => {
    render(TextureTimeline, {
      props: {
        ageMonths: 7,
        progress: { tried: [], mostRecent: null }
      }
    });
    expect(screen.getByText('Progression des textures')).toBeTruthy();
    // At 7 months, default texture is 'ecrasee'
    expect(screen.getByText(/À 7 mois, la texture par défaut est/)).toBeTruthy();
  });

  it('renders the 5-step ladder', () => {
    const { container } = render(TextureTimeline, {
      props: { ageMonths: 7, progress: { tried: [], mostRecent: null } }
    });
    const items = container.querySelectorAll('ol li');
    expect(items.length).toBe(5);
  });

  it('shows the parallel finger-food row with the dashed hint', () => {
    render(TextureTimeline, {
      props: { ageMonths: 8, progress: { tried: [], mostRecent: null } }
    });
    expect(screen.getByText(/Aliments à saisir/)).toBeTruthy();
    expect(screen.getByText(/Optionnel à partir de 6 mois/)).toBeTruthy();
  });

  it('marks tried textures with "Déjà essayée"', () => {
    render(TextureTimeline, {
      props: {
        ageMonths: 10,
        progress: { tried: ['lisse', 'moulinee'], mostRecent: null }
      }
    });
    // 'lisse' and 'moulinee' are tried; 'ecrasee' is expected at 10mo? defaultTextureForAgeMonths(10) = 'petits-morceaux'
    // So 'lisse' and 'moulinee' show 'Déjà essayée'
    expect(screen.getAllByText('Déjà essayée').length).toBeGreaterThanOrEqual(2);
  });

  it('marks the mostRecent texture with "Texture la plus récente"', () => {
    render(TextureTimeline, {
      props: {
        ageMonths: 8,
        progress: { tried: ['lisse', 'moulinee', 'ecrasee'], mostRecent: 'ecrasee' }
      }
    });
    expect(screen.getByText('Texture la plus récente')).toBeTruthy();
  });

  it('marks the age-default texture with "Attendue à cet âge" when it has not been logged', () => {
    render(TextureTimeline, {
      props: {
        ageMonths: 7,
        progress: { tried: ['lisse'], mostRecent: null }
      }
    });
    // At 7 months default is 'ecrasee'; not in tried, not the mostRecent → "Attendue à cet âge"
    expect(screen.getByText('Attendue à cet âge')).toBeTruthy();
  });
});
