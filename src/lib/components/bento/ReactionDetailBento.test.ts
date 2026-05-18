// @vitest-environment happy-dom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ReactionDetailBento from './ReactionDetailBento.svelte';

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('ReactionDetailBento', () => {
  const baseProps = {
    childId: 'abc',
    entryId: 1,
    food: 'Poire',
    nth: 2,
    date: '15 mai',
    time: '11:30',
    symptoms: [{ id: 1, label: 'rougeur' as const, observedAt: '11:42', note: 'joue gauche' }],
    printHref: '/child/abc/foods/1/print',
    editHref: '/child/abc/log/1?from=detail'
  };

  it('renders the title and subtitle', () => {
    render(ReactionDetailBento, { props: baseProps });
    expect(screen.getByText('Réaction · Poire')).toBeTruthy();
    expect(screen.getByText('15 mai · 11:30 · 2 exposition')).toBeTruthy();
  });

  it('renders the reassurance hero', () => {
    render(ReactionDetailBento, { props: baseProps });
    expect(screen.getByText(/On vous accompagne/)).toBeTruthy();
  });

  it('renders the symptoms section', () => {
    render(ReactionDetailBento, { props: baseProps });
    expect(screen.getByText('Symptômes observés')).toBeTruthy();
    expect(screen.getByText('Rougeur')).toBeTruthy();
  });

  it('renders the stay-cool card', () => {
    render(ReactionDetailBento, { props: baseProps });
    expect(screen.getByText('Respirez')).toBeTruthy();
  });

  it('renders the severe rail', () => {
    render(ReactionDetailBento, { props: baseProps });
    expect(screen.getByText(/Difficulté à respirer/)).toBeTruthy();
  });

  it('renders the monitor timer start CTA', () => {
    render(ReactionDetailBento, { props: baseProps });
    expect(screen.getByRole('button', { name: /Suivre 30 min/ })).toBeTruthy();
  });

  it('renders the export CTA linking to the print href in a new tab', () => {
    render(ReactionDetailBento, { props: baseProps });
    const link = screen.getByText('Exporter pour le pédiatre').closest('a');
    expect(link?.getAttribute('href')).toBe('/child/abc/foods/1/print');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it('renders the back-to-carnet link with childId', () => {
    render(ReactionDetailBento, { props: baseProps });
    const link = screen.getByText('Retour au carnet').closest('a');
    expect(link?.getAttribute('href')).toBe('/child/abc/foods');
  });

  it('renders the edit-meal link with from=detail', () => {
    render(ReactionDetailBento, { props: baseProps });
    const link = screen.getByText('Modifier ce repas').closest('a');
    expect(link?.getAttribute('href')).toBe('/child/abc/log/1?from=detail');
  });
});
