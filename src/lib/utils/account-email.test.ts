import { describe, expect, it } from 'bun:test';
import { matchesAccountEmail } from './account-email';

describe('matchesAccountEmail', () => {
  it('trims the typed value and ignores case on both sides', () => {
    expect(matchesAccountEmail('  PARENT@example.com ', 'Parent@Example.com')).toBe(true);
  });

  it('rejects another address', () => {
    expect(matchesAccountEmail('autre@example.com', 'parent@example.com')).toBe(false);
  });

  it('rejects an empty entry', () => {
    expect(matchesAccountEmail('', 'parent@example.com')).toBe(false);
  });
});
