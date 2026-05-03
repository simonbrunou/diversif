import { describe, it, expect } from 'vitest';
import { generateInviteCodeRaw, isValidInviteCodeFormat } from './invites';

describe('generateInviteCodeRaw', () => {
  it('produces codes that pass the format check', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateInviteCodeRaw();
      expect(code).toMatch(/^BEBE-[A-Z2-9]{4}$/);
      expect(isValidInviteCodeFormat(code)).toBe(true);
    }
  });
});

describe('isValidInviteCodeFormat', () => {
  it('accepts codes from the safe alphabet', () => {
    expect(isValidInviteCodeFormat('BEBE-ABCD')).toBe(true);
    expect(isValidInviteCodeFormat('BEBE-2345')).toBe(true);
  });

  it('rejects ambiguous characters', () => {
    expect(isValidInviteCodeFormat('BEBE-0BCD')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-OBCD')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-1BCD')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-IBCD')).toBe(false);
  });

  it('rejects malformed codes', () => {
    expect(isValidInviteCodeFormat('bebe-ABCD')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-AB')).toBe(false);
    expect(isValidInviteCodeFormat('NOPE-ABCD')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE_ABCD')).toBe(false);
    expect(isValidInviteCodeFormat('')).toBe(false);
  });
});
