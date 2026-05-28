import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/svelte';
import StatTiles from './StatTiles.svelte';

afterEach(() => cleanup());

describe('StatTiles', () => {
  it('renders the foods count and week delta', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 12, weekCount: 4, streakCurrent: 3, streakRecord: 5 }
    });
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('+4 cette semaine')).toBeTruthy();
  });

  it('renders the streak days', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 0, weekCount: 0, streakCurrent: 7, streakRecord: 9 }
    });
    expect(screen.getByText('7 jours')).toBeTruthy();
  });

  it('pluralizes the streak to singular at 1', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 0, weekCount: 0, streakCurrent: 1, streakRecord: 3 }
    });
    expect(screen.getByText('1 jour')).toBeTruthy();
    expect(screen.queryByText('1 jours')).toBeNull();
  });

  it('hides the week delta when weekCount is 0', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 0, weekCount: 0, streakCurrent: 0, streakRecord: 0 }
    });
    expect(screen.queryByText('+0 cette semaine')).toBeNull();
  });

  it('shows the record indicator when current === record', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 0, weekCount: 0, streakCurrent: 5, streakRecord: 5 }
    });
    expect(screen.getByText('meilleur score')).toBeTruthy();
  });

  it('hides the record indicator when current < record', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 0, weekCount: 0, streakCurrent: 3, streakRecord: 5 }
    });
    expect(screen.queryByText('meilleur score')).toBeNull();
  });
});
