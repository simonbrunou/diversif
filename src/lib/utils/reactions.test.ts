import { describe, it, expect } from 'vitest';
import { REACTIONS, getReactionLabel, type ReactionId } from './reactions';

describe('REACTIONS', () => {
  it('exposes ras / inconfort / reaction', () => {
    expect(REACTIONS.map((r) => r.id)).toEqual(['ras', 'inconfort', 'reaction']);
  });
});

describe('getReactionLabel', () => {
  it('returns the matching label', () => {
    expect(getReactionLabel('ras')).toBe('RAS');
    expect(getReactionLabel('inconfort')).toBe('Inconfort');
    expect(getReactionLabel('reaction')).toBe('Réaction');
  });

  it('falls back to the id when unknown (defensive)', () => {
    // Cast through unknown to exercise the fallback branch even though the
    // type system would normally prevent this.
    expect(getReactionLabel('mystery' as unknown as ReactionId)).toBe('mystery');
  });
});
