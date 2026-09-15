import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import * as m from '$lib/paraglide/messages';
import StatTiles from './StatTiles.svelte';

afterEach(() => cleanup());

describe('StatTiles', () => {
  it('renders the foods count and the week delta', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 12, weekCount: 4, streakCurrent: 3, streakRecord: 5 }
    });
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText(m.aujourdhuiBilanAlimentsDeltaOther({ count: '4' }))).toBeTruthy();
  });

  it('renders the streak count and its unit, pluralized', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 9, weekCount: 0, streakCurrent: 7, streakRecord: 7 }
    });
    expect(screen.getByText('7')).toBeTruthy();
    expect(screen.getByText(m.aujourdhuiBilanStreakUnitOther())).toBeTruthy();
  });

  it('uses the singular unit at a one-day streak', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 9, weekCount: 0, streakCurrent: 1, streakRecord: 1 }
    });
    expect(screen.getByText(m.aujourdhuiBilanStreakUnitOne())).toBeTruthy();
    expect(screen.queryByText(m.aujourdhuiBilanStreakUnitOther())).toBeNull();
  });

  it('hides the week delta when nothing is new this week', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 9, weekCount: 0, streakCurrent: 2, streakRecord: 2 }
    });
    expect(screen.queryByText(m.aujourdhuiBilanAlimentsDeltaOther({ count: '0' }))).toBeNull();
  });

  // The record line is context, not praise. It appears only while the parent
  // is BELOW their best — where it tells them something the big number does
  // not. The previous component passed the current streak as its own record,
  // so "meilleur score" fired for any streak >= 1 and told a first-timer that
  // one day was her personal best.
  it('shows the record only while the current streak is behind it', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 9, weekCount: 0, streakCurrent: 3, streakRecord: 5 }
    });
    expect(screen.getByText(m.aujourdhuiBilanStreakRecordOther({ days: '5' }))).toBeTruthy();
  });

  it('stays silent about the record when the current streak equals it', () => {
    render(StatTiles, {
      props: { foodsIntroduced: 9, weekCount: 0, streakCurrent: 5, streakRecord: 5 }
    });
    expect(screen.queryByText(m.aujourdhuiBilanStreakRecordOther({ days: '5' }))).toBeNull();
  });

  // Honest empty state: a fresh child gets no tiles at all rather than a pair
  // of zeros dressed up as statistics.
  it('renders nothing before the first food is logged', () => {
    const { container } = render(StatTiles, {
      props: { foodsIntroduced: 0, weekCount: 0, streakCurrent: 0, streakRecord: 0 }
    });
    expect(container.textContent?.trim()).toBe('');
  });

  // The brief requires tabular figures on stat displays so the numbers don't
  // jitter when they tick over; both numerals are live-updating counters.
  it('sets tabular figures on both numerals', () => {
    const { container } = render(StatTiles, {
      props: { foodsIntroduced: 12, weekCount: 1, streakCurrent: 3, streakRecord: 3 }
    });
    const numerals = container.querySelectorAll('.tabular-nums');
    expect(numerals.length).toBe(2);
  });
});
