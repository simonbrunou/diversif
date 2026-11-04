import { beforeEach, describe, expect, it } from 'bun:test';
import { stubGlobal } from '../test/bun-test-utils';
import { isHydrated, markHydrated, onHydrated, resetHydration } from './hydration';

// Before, not after: the preload's afterEach, which puts back a stubbed
// document, runs after this file's.
beforeEach(() => resetHydration());

describe('isHydrated', () => {
  it('is false until the root layout marks the app as started', () => {
    expect(isHydrated()).toBe(false);
    markHydrated();
    expect(isHydrated()).toBe(true);
  });

  it('is false on the server, where there is no document', () => {
    stubGlobal('document', undefined);
    expect(isHydrated()).toBe(false);
  });

  it('is false again after a reset, as on a new page load', () => {
    markHydrated();
    resetHydration();
    expect(isHydrated()).toBe(false);
  });
});

describe('onHydrated', () => {
  it('runs a registered callback once the app is marked, and after the marker is set', () => {
    const seen: boolean[] = [];
    onHydrated(() => seen.push(isHydrated()));
    expect(seen).toEqual([]);

    markHydrated();

    expect(seen).toEqual([true]);
  });
});
