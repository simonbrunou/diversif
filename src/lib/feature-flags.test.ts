// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { bentoEnabled } from './feature-flags';

describe('bentoEnabled', () => {
  const owner = 'simon.brunou@proton.me';
  const otherUser = 'someone@example.com';

  it('returns false by default for non-owner', () => {
    expect(bentoEnabled(otherUser, new Map())).toBe(false);
  });

  it('returns true for the owner email', () => {
    expect(bentoEnabled(owner, new Map())).toBe(true);
  });

  it('returns true when the bento=1 cookie is set, regardless of email', () => {
    expect(bentoEnabled(otherUser, new Map([['bento', '1']]))).toBe(true);
  });

  it('returns false when bento cookie is anything other than "1"', () => {
    expect(bentoEnabled(otherUser, new Map([['bento', '0']]))).toBe(false);
    expect(bentoEnabled(otherUser, new Map([['bento', 'true']]))).toBe(false);
  });

  it('handles undefined email gracefully (anonymous visitor)', () => {
    expect(bentoEnabled(undefined, new Map())).toBe(false);
    expect(bentoEnabled(undefined, new Map([['bento', '1']]))).toBe(true);
  });
});
