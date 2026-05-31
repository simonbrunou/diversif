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

  it('rejects legacy 4-char codes', () => {
    expect(isValidInviteCodeFormat('BEBE-ABCD')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-2345')).toBe(false);
  });

  it('rejects ambiguous characters in either length', () => {
    expect(isValidInviteCodeFormat('BEBE-0BCDEF')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-OBCDEF')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-1BCDEF')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-IBCDEF')).toBe(false);
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
