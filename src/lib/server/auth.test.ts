import { describe, it, expect } from 'vitest';
import { isValidInviteCodeFormat, generateInviteCodeRaw } from '$lib/utils/invites';

describe('isValidInviteCodeFormat', () => {
  it('accepts BEBE-XXXXXX with safe alphabet', () => {
    expect(isValidInviteCodeFormat('BEBE-A2B3C4')).toBe(true);
    expect(isValidInviteCodeFormat('BEBE-XYZWVU')).toBe(true);
  });
  it('rejects ambiguous chars 0/O/I/1', () => {
    expect(isValidInviteCodeFormat('BEBE-0ABCDE')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-OABCDE')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-1ABCDE')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-IABCDE')).toBe(false);
  });
  it('rejects wrong shape', () => {
    expect(isValidInviteCodeFormat('bebe-abcdef')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-ABCDE')).toBe(false);
    expect(isValidInviteCodeFormat('NOPE-ABCDEF')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE_ABCDEF')).toBe(false);
  });
});

describe('generateInviteCodeRaw', () => {
  it('produces a valid BEBE- code', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCodeRaw();
      expect(code).toMatch(/^BEBE-[A-Z2-9]{6}$/);
      expect(isValidInviteCodeFormat(code)).toBe(true);
    }
  });
});
