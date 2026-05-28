import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import Recipes from './Recipes.svelte';
import type { Recipe } from '$lib/content/recipes';

afterEach(() => cleanup());

const SAMPLE: Recipe[] = [
  {
    id: 'puree-carotte',
    stage: '4-6',
    title: 'Purée de carotte',
    subtitle: 'Simple et douce.',
    timeMinutes: 20,
    ingredients: ['2 carottes', '1 c. à café d’huile de colza']
  },
  {
    id: 'compote-pomme',
    stage: '4-6',
    title: 'Compote de pomme',
    subtitle: 'Sans sucre ajouté.',
    timeMinutes: 15,
    ingredients: ['2 pommes', '1 c. à soupe d’eau']
  }
];

describe('Recipes', () => {
  it('renders the section header and subtitle', () => {
    render(Recipes, { props: { recipes: SAMPLE } });
    expect(screen.getByText('Idées de préparation')).toBeTruthy();
    expect(screen.getByText(/Quelques pistes simples/)).toBeTruthy();
  });

  it('renders one card per recipe with title and time chip', () => {
    render(Recipes, { props: { recipes: SAMPLE } });
    expect(screen.getByText('Purée de carotte')).toBeTruthy();
    expect(screen.getByText('Compote de pomme')).toBeTruthy();
    expect(screen.getByText('20 min')).toBeTruthy();
    expect(screen.getByText('15 min')).toBeTruthy();
  });

  it('hides the ingredients list by default and reveals it on tap', async () => {
    render(Recipes, { props: { recipes: SAMPLE } });
    expect(screen.queryByText('2 carottes')).toBeNull();
    const button = screen.getByRole('button', { name: /Purée de carotte/ });
    await fireEvent.click(button);
    expect(screen.getByText('2 carottes')).toBeTruthy();
    expect(screen.getByText(/Ingrédients/)).toBeTruthy();
  });

  it('toggles only one open card at a time', async () => {
    render(Recipes, { props: { recipes: SAMPLE } });
    const carotte = screen.getByRole('button', { name: /Purée de carotte/ });
    const pomme = screen.getByRole('button', { name: /Compote de pomme/ });
    await fireEvent.click(carotte);
    expect(screen.getByText('2 carottes')).toBeTruthy();
    await fireEvent.click(pomme);
    expect(screen.queryByText('2 carottes')).toBeNull();
    expect(screen.getByText('2 pommes')).toBeTruthy();
  });

  it('renders the empty hint with title when recipes is empty', () => {
    render(Recipes, { props: { recipes: [] } });
    expect(screen.getByText(/Pas encore d’idées/)).toBeTruthy();
  });

  it('renders the disclaimer when recipes are shown', () => {
    render(Recipes, { props: { recipes: SAMPLE } });
    expect(screen.getByText(/Diversif n’est pas un livre de recettes/)).toBeTruthy();
  });
});
