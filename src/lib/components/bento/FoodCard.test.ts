// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
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

  it('renders à essayer meta when tried === 0', () => {
    render(FoodCard, {
      props: { name: 'Œuf', category: 'oeufs', tried: 0, status: 'todo' }
    });
    expect(screen.getByText('à essayer')).toBeTruthy();
  });

  it('uses dashed border when tried === 0', () => {
    const { container } = render(FoodCard, {
      props: { name: 'Œuf', category: 'oeufs', tried: 0, status: 'todo' }
    });
    expect(container.querySelector('article')?.className).toContain('border-dashed');
  });
});
