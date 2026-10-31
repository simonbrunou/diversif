import { describe, expect, it, mock } from 'bun:test';
import { pinHostZone } from '../../test/bun-test-utils';

// Flips $app/env.browser between tests, as theme.test.ts does: each call
// re-registers the mock, and date-input.ts reads the new value when called.
function setBrowser(value: boolean): void {
  mock.module('$app/env', () => ({
    browser: value,
    building: false,
    dev: true,
    version: 'test'
  }));
}

setBrowser(false);

const { dateInputInstant, dateInputValue } = await import('./date-input');

const STORED = new Date('2026-06-01T10:00:00Z'); // 12:00 in Paris, 19:00 in Tokyo

// #485: the server runs in UTC in production and renders Paris time; the
// browser renders its own zone.
describe('in the server render, on a host in UTC', () => {
  pinHostZone('UTC');

  it('shows the stored instant on Paris clocks', () => {
    setBrowser(false);
    expect(dateInputValue(STORED)).toBe('2026-06-01T12:00');
  });

  it('reads the value back as Paris time', () => {
    setBrowser(false);
    expect(dateInputInstant('2026-06-01T12:00')).toEqual(STORED);
  });

  // The log page derives the child's age from the value it renders: read as
  // UTC, 22:30 in Paris on 30 June would already be 1 July.
  it('reads back the instant it rendered, late in the Paris evening', () => {
    setBrowser(false);
    const now = new Date('2026-06-30T20:30:00Z');
    expect(dateInputInstant(dateInputValue(now))).toEqual(now);
  });
});

describe('in the browser, on a host in Tokyo', () => {
  pinHostZone('Asia/Tokyo');

  it("shows the stored instant on the browser's clock", () => {
    setBrowser(true);
    expect(dateInputValue(STORED)).toBe('2026-06-01T19:00');
  });

  it("reads the value back in the browser's zone", () => {
    setBrowser(true);
    expect(dateInputInstant('2026-06-01T19:00')).toEqual(STORED);
  });
});
