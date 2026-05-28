import { describe, expect, it } from 'bun:test';
import { generateInviteCodeRaw, isValidInviteCodeFormat } from './invites';

describe('generateInviteCodeRaw', () => {
  it('produces codes that pass the format check', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInviteCodeRaw();
      expect(code).toMatch(/^BEBE-[A-Z2-9]{6}$/);
      expect(isValidInviteCodeFormat(code)).toBe(true);
    }
  });
});

describe('isValidInviteCodeFormat', () => {
  it('accepts 6-char codes from the safe alphabet', () => {
    expect(isValidInviteCodeFormat('BEBE-ABCDEF')).toBe(true);
    expect(isValidInviteCodeFormat('BEBE-234567')).toBe(true);
  });

  it('still accepts legacy 4-char codes during the rollout window', () => {
    // Codes generated before the entropy bump may still be in the DB
    // up to the 7-day invite TTL. Rejecting them outright would break
    // onboarding for anyone holding an in-flight 4-char invite link.
    expect(isValidInviteCodeFormat('BEBE-ABCD')).toBe(true);
    expect(isValidInviteCodeFormat('BEBE-2345')).toBe(true);
  });

  it('rejects ambiguous characters in either length', () => {
    expect(isValidInviteCodeFormat('BEBE-0BCDEF')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-OBCDEF')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-1BCDEF')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-IBCDEF')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-0BCD')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-OBCD')).toBe(false);
  });

  it('rejects malformed codes', () => {
    expect(isValidInviteCodeFormat('bebe-ABCDEF')).toBe(false);
    // Lengths other than 4 or 6 (e.g., 5) should still fail.
    expect(isValidInviteCodeFormat('BEBE-ABCDE')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-ABC')).toBe(false);
    expect(isValidInviteCodeFormat('NOPE-ABCDEF')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE_ABCDEF')).toBe(false);
    expect(isValidInviteCodeFormat('')).toBe(false);
  });
});
