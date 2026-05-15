// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import RgpdSection from './RgpdSection.svelte';

afterEach(() => cleanup());

describe('RgpdSection', () => {
  it('renders the export row linking to /account/export', () => {
    render(RgpdSection, {});
    const exp = screen.getByText('Exporter mes données').closest('a');
    expect(exp?.getAttribute('href')).toBe('/account/export');
  });

  it('renders the delete row linking to /account/delete', () => {
    render(RgpdSection, {});
    const del = screen.getByText('Supprimer mon compte').closest('a');
    expect(del?.getAttribute('href')).toBe('/account/delete');
  });
});
