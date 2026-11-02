import { describe, expect, it } from 'bun:test';
import { resolveMessageKey } from './message-key';

describe('resolveMessageKey', () => {
  it('returns the resolved FR message for a known key', () => {
    // chromeBack is a known key in the paraglide bundle.
    const out = resolveMessageKey('chromeBack');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});
