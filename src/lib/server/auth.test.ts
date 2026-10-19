import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';
import { seedChild, seedUser } from '../../test/route';
import { memberships } from './db/schema';
import { isValidInviteCodeFormat, generateInviteCodeRaw } from '#lib/utils/invites.js';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

const {
  hashPassword,
  verifyPassword,
  verifyPasswordOrDecoy,
  findUserByEmail,
  listMembershipsForUser
} = await import('./auth');

beforeEach(async () => {
  await resetTestDb();
});

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

describe('hashPassword / verifyPassword', () => {
  it('verifies a matching password', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword(hash, 'correct horse')).toBe(true);
  });

  it('rejects a mismatching password', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword(hash, 'battery staple')).toBe(false);
  });

  it('returns false on malformed hash without throwing', async () => {
    expect(await verifyPassword('not-a-valid-argon-hash', 'whatever')).toBe(false);
  });
});

describe('findUserByEmail', () => {
  it('finds a user by case-insensitive email', async () => {
    const user = await seedUser({ email: 'Parent@Example.com' });
    expect((await findUserByEmail('parent@example.com'))?.id).toBe(user.id);
    expect((await findUserByEmail('PARENT@EXAMPLE.COM'))?.id).toBe(user.id);
  });

  it('returns undefined for unknown email', async () => {
    expect(await findUserByEmail('nobody@example.com')).toBeUndefined();
  });
});

describe('listMembershipsForUser', () => {
  it('returns empty array for new user', async () => {
    const user = await seedUser();
    expect(await listMembershipsForUser(user.id)).toEqual([]);
  });

  it('returns memberships for the user only', async () => {
    const user = await seedUser({ email: 'a@example.com' });
    const other = await seedUser({ email: 'b@example.com' });

    const child = await seedChild({ createdBy: user.id });

    await testDb.insert(memberships).values({
      userId: user.id,
      childId: child.id,
      role: 'owner',
      createdAt: new Date()
    });

    expect((await listMembershipsForUser(user.id)).length).toBe(1);
    expect(await listMembershipsForUser(other.id)).toEqual([]);
  });

  it('orders memberships by joined-at, not by child id or row order', async () => {
    const user = await seedUser({ email: 'order@example.com' });
    const coParented = await seedChild({ name: 'Aîné', createdBy: user.id });
    const own = await seedChild({ name: 'Cadet', createdBy: user.id });

    // The user created their own child first, then joined an OLDER child
    // (smaller id) via invitation. kids[0] is the nav fallback target, so
    // join order must win over child id — otherwise the co-parented child
    // silently becomes the default log target. The later-joined membership
    // is INSERTED first so neither child id nor SQLite row order coincides
    // with the expected result — only ORDER BY createdAt produces it.
    await testDb.insert(memberships).values({
      userId: user.id,
      childId: coParented.id,
      role: 'member',
      createdAt: new Date('2026-02-01T00:00:00Z')
    });
    await testDb.insert(memberships).values({
      userId: user.id,
      childId: own.id,
      role: 'owner',
      createdAt: new Date('2026-01-01T00:00:00Z')
    });

    const rows = await listMembershipsForUser(user.id);
    expect(rows.map((r) => r.childId)).toEqual([own.id, coParented.id]);
  });
});
