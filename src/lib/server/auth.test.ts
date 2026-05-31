import { describe, expect, it, mock } from 'bun:test';
import { testDb } from '../../test/db';
import { isValidInviteCodeFormat, generateInviteCodeRaw } from '$lib/utils/invites';

mock.module('$lib/server/db', () => ({ db: testDb }));

const { hashPassword, verifyPasswordOrDecoy } = await import('./auth');

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
    expect(isValidInviteCodeFormat('BEBE-ABCD')).toBe(false);
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

describe('verifyPasswordOrDecoy', () => {
  it('returns false when no hash is provided (null)', async () => {
    const ok = await verifyPasswordOrDecoy(null, 'whatever');
    expect(ok).toBe(false);
  });

  it('returns false when no hash is provided (undefined)', async () => {
    const ok = await verifyPasswordOrDecoy(undefined, 'whatever');
    expect(ok).toBe(false);
  });

  it('returns true when the password matches the real hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    const ok = await verifyPasswordOrDecoy(hash, 'correct-horse-battery-staple');
    expect(ok).toBe(true);
  });

  it('returns false when the password does not match the real hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    const ok = await verifyPasswordOrDecoy(hash, 'wrong-password');
    expect(ok).toBe(false);
  });
});
