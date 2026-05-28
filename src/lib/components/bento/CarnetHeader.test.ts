import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/svelte';
import CarnetHeader from './CarnetHeader.svelte';

afterEach(() => cleanup());

describe('CarnetHeader', () => {
  it('renders the title and counts subline', () => {
    render(CarnetHeader, { props: { foodCount: 47, categoryCount: 12 } });
    expect(screen.getByText('Carnet')).toBeTruthy();
    expect(screen.getByText('47 aliments · 12 catégories')).toBeTruthy();
  });

  it('pluralizes both counts to singular at 1', () => {
    render(CarnetHeader, { props: { foodCount: 1, categoryCount: 1 } });
    expect(screen.getByText('1 aliment · 1 catégorie')).toBeTruthy();
  });
});
