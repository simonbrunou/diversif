import { describe, it, expect } from 'vitest';
import { isValidInviteCodeFormat, generateInviteCodeRaw } from '$lib/utils/invites';

describe('isValidInviteCodeFormat', () => {
  it('accepts BEBE-XXXX with safe alphabet', () => {
    expect(isValidInviteCodeFormat('BEBE-A2B3')).toBe(true);
    expect(isValidInviteCodeFormat('BEBE-XYZW')).toBe(true);
  });
  it('rejects ambiguous chars 0/O/I/1', () => {
    expect(isValidInviteCodeFormat('BEBE-0ABC')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-OABC')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-1ABC')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-IABC')).toBe(false);
  });
  it('rejects wrong shape', () => {
    expect(isValidInviteCodeFormat('bebe-abcd')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE-ABC')).toBe(false);
    expect(isValidInviteCodeFormat('NOPE-ABCD')).toBe(false);
    expect(isValidInviteCodeFormat('BEBE_ABCD')).toBe(false);
  });
});

describe('generateInviteCodeRaw', () => {
  it('produces a valid BEBE- code', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateInviteCodeRaw();
      expect(code).toMatch(/^BEBE-[A-Z2-9]{4}$/);
      expect(isValidInviteCodeFormat(code)).toBe(true);
    }
  });
});
