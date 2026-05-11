// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import CarnetHeader from './CarnetHeader.svelte';

afterEach(() => cleanup());

describe('CarnetHeader', () => {
  it('renders the title and counts subline', () => {
    render(CarnetHeader, { props: { foodCount: 47, categoryCount: 12 } });
    expect(screen.getByText('Carnet')).toBeTruthy();
    expect(screen.getByText('47 aliments · 12 catégories')).toBeTruthy();
  });
});
