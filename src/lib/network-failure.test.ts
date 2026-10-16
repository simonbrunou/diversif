import { describe, expect, it } from 'bun:test';
import { isNetworkFailure } from './network-failure';

describe('isNetworkFailure', () => {
  it.each([
    'Failed to fetch',
    'Failed to fetch (diversif.app)',
    'network error',
    'Failed to fetch dynamically imported module: https://diversif.app/_app/immutable/nodes/19.x.js',
    'NetworkError when attempting to fetch resource.',
    'NetworkError when attempting to fetch resource. (diversif.app)',
    'error loading dynamically imported module: https://diversif.app/_app/immutable/nodes/19.x.js',
    'Load failed',
    'Load failed (diversif.app)',
    'The Internet connection appears to be offline.',
    'Importing a module script failed.',
    'Error in input stream'
  ])('recognises the browser TypeError %p', (message) => {
    expect(isNetworkFailure(new TypeError(message))).toBe(true);
  });

  it('reports TypeErrors raised by app code', () => {
    expect(
      isNetworkFailure(new TypeError("Cannot read properties of undefined (reading 'id')"))
    ).toBe(false);
    // Only the whole message counts: app code quoting a network error is a bug.
    expect(isNetworkFailure(new TypeError('Parsing failed: Failed to fetch'))).toBe(false);
  });

  it('reports a network-looking message that is not a TypeError', () => {
    expect(isNetworkFailure(new Error('Failed to fetch'))).toBe(false);
    expect(isNetworkFailure('Failed to fetch')).toBe(false);
    expect(isNetworkFailure(undefined)).toBe(false);
  });
});
