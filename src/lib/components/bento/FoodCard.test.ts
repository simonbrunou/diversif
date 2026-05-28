import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/svelte';
import FoodCard from './FoodCard.svelte';

afterEach(() => cleanup());

describe('FoodCard', () => {
  it('renders the food name', () => {
    render(FoodCard, {
      props: { name: 'Poire', category: 'fruits', tried: 3, status: 'ras' }
    });
    expect(screen.getByText('Poire')).toBeTruthy();
  });

  it('renders the tried-count meta when tried > 0', () => {
    render(FoodCard, {
      props: { name: 'Poire', category: 'fruits', tried: 3, status: 'ras' }
    });
    expect(screen.getByText('3×')).toBeTruthy();
  });

  it('renders à découvrir meta when tried === 0', () => {
    render(FoodCard, {
      props: { name: 'Œuf', category: 'oeufs', tried: 0, status: 'todo' }
    });
    expect(screen.getByText('à découvrir')).toBeTruthy();
  });

  it('uses dashed border when tried === 0', () => {
    const { container } = render(FoodCard, {
      props: { name: 'Œuf', category: 'oeufs', tried: 0, status: 'todo' }
    });
    expect(container.querySelector('article')?.className).toContain('border-dashed');
  });

  it('renders as <a> when status is reaction and href is provided', () => {
    const { container } = render(FoodCard, {
      props: {
        name: 'Poire',
        category: 'fruits',
        tried: 2,
        status: 'reaction',
        href: '/child/1/foods/42'
      }
    });
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/child/1/foods/42');
    expect(container.querySelector('article')).toBeNull();
  });

  it('renders as <a> when status is inconfort and href is provided', () => {
    const { container } = render(FoodCard, {
      props: {
        name: 'Banane',
        category: 'fruits',
        tried: 1,
        status: 'inconfort',
        href: '/child/1/foods/7'
      }
    });
    expect(container.querySelector('a')).toBeTruthy();
    expect(container.querySelector('article')).toBeNull();
  });

  it('renders as <article> when status is non-RAS but href is not provided', () => {
    const { container } = render(FoodCard, {
      props: { name: 'Poire', category: 'fruits', tried: 2, status: 'reaction' }
    });
    expect(container.querySelector('article')).toBeTruthy();
    expect(container.querySelector('a')).toBeNull();
  });

  it('renders as <a> for RAS status when href is provided (late-reaction reachable)', () => {
    const { container } = render(FoodCard, {
      props: {
        name: 'Poire',
        category: 'fruits',
        tried: 3,
        status: 'ras',
        href: '/child/1/foods/10'
      }
    });
    const link = container.querySelector('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/child/1/foods/10');
    expect(container.querySelector('article')).toBeNull();
  });

  it('renders as <article> when tried === 0 even if href is provided', () => {
    const { container } = render(FoodCard, {
      props: {
        name: 'Œuf',
        category: 'oeufs',
        tried: 0,
        status: 'todo',
        href: '/child/1/foods/1'
      }
    });
    expect(container.querySelector('article')).toBeTruthy();
    expect(container.querySelector('a')).toBeNull();
  });
});
