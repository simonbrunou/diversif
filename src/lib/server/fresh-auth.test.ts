import { afterEach, describe, it, expect, vi } from 'vitest';
import { testDb } from '../../test/db';
import { _clearAllRateLimits } from './rate-limit';

// Use the in-memory pg-mem db so we can insert real rows without a live PG.
vi.mock('$lib/server/db', () => ({ db: testDb }));

// Import after mocks are in place.
const { requireFreshAuth, requireFreshAuthWithKey } = await import('./fresh-auth');
const { hashPassword } = await import('./auth');

import type { SafeUser } from '$lib/types';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

const fakeUser: SafeUser = {
  id: 9001,
  email: 'fresh@example.com',
  displayName: 'Fresh',
  createdAt: new Date('2024-01-01T00:00:00Z')
};

afterEach(() => {
  _clearAllRateLimits();
});

async function insertUserWithPassword(password: string) {
  const hash = await hashPassword(password);
  await db
    .insert(users)
    .values({
      id: fakeUser.id,
      email: fakeUser.email,
      displayName: fakeUser.displayName,
      passwordHash: hash,
      createdAt: fakeUser.createdAt
    })
    .onConflictDoUpdate({ target: users.id, set: { passwordHash: hash } });
}

describe('requireFreshAuth', () => {
  it('returns ok:true when password is correct', async () => {
    await insertUserWithPassword('correct-password-123');
    const result = await requireFreshAuth(fakeUser, 'correct-password-123');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(true);
  });

  it('returns ok:false with 400 when password is wrong', async () => {
    await insertUserWithPassword('correct-password-123');
    const result = await requireFreshAuth(fakeUser, 'wrong-password');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(400);
  });

  it('returns ok:false with 429 when rate limit is hit', async () => {
    await insertUserWithPassword('pw');
    // Exhaust the 5-attempt budget first (all wrong passwords, but the budget
    // is consumed regardless of outcome).
    for (let i = 0; i < 5; i++) {
      await requireFreshAuth(fakeUser, 'wrong', { rateLimitKey: String(fakeUser.id) });
    }
    const result = await requireFreshAuth(fakeUser, 'pw', { rateLimitKey: String(fakeUser.id) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.status).toBe(429);
  });

  it('throws when the DB returns no row for the user (invariant violation)', async () => {
    // Use a user id that has no DB row — the helper should throw, not fail.
    const ghost: SafeUser = { ...fakeUser, id: 99999 };
    await expect(requireFreshAuth(ghost, 'whatever')).rejects.toThrow(/no password hash/);
  });

  it('invokes onMissingUser when the DB row is gone (race)', async () => {
    const ghost: SafeUser = { ...fakeUser, id: 88880 };
    const onMissingUser = vi.fn(() => {
      throw new Error('REDIRECT_TO_LOGIN');
    });
    await expect(requireFreshAuth(ghost, 'whatever', { onMissingUser })).rejects.toThrow(
      /REDIRECT_TO_LOGIN/
    );
    expect(onMissingUser).toHaveBeenCalled();
  });
});

describe('requireFreshAuthWithKey', () => {
  const keyOpts = {
    field: 'passwordErrorKey' as const,
    rateLimitedKey: 'errorsAuthRateLimited',
    incorrectKey: 'errorsAccountPasswordIncorrect'
  };

  it('returns ok:true when password is correct', async () => {
    await insertUserWithPassword('correct-password-123');
    const result = await requireFreshAuthWithKey(fakeUser, 'correct-password-123', keyOpts);
    expect(result.ok).toBe(true);
  });

  it('returns the caller-specified field + incorrectKey on wrong password', async () => {
    await insertUserWithPassword('correct-password-123');
    const result = await requireFreshAuthWithKey(fakeUser, 'wrong-password', keyOpts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.status).toBe(400);
      const data = result.failure.data as Record<string, string>;
      expect(data.passwordErrorKey).toBe('errorsAccountPasswordIncorrect');
    }
  });

  it('returns rateLimitedKey on 429', async () => {
    await insertUserWithPassword('pw');
    for (let i = 0; i < 5; i++) {
      await requireFreshAuthWithKey(fakeUser, 'wrong', { ...keyOpts, rateLimitKey: 'k1' });
    }
    const result = await requireFreshAuthWithKey(fakeUser, 'pw', {
      ...keyOpts,
      rateLimitKey: 'k1'
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.status).toBe(429);
      const data = result.failure.data as Record<string, string>;
      expect(data.passwordErrorKey).toBe('errorsAuthRateLimited');
    }
  });

  it('invokes onMissingUser when the DB row is gone (race)', async () => {
    const ghost: SafeUser = { ...fakeUser, id: 88888 };
    const onMissingUser = vi.fn(() => {
      throw new Error('REDIRECT_TO_LOGIN');
    });
    await expect(
      requireFreshAuthWithKey(ghost, 'whatever', { ...keyOpts, onMissingUser })
    ).rejects.toThrow(/REDIRECT_TO_LOGIN/);
    expect(onMissingUser).toHaveBeenCalled();
  });

  it('throws when no onMissingUser and the DB row is gone', async () => {
    const ghost: SafeUser = { ...fakeUser, id: 77777 };
    await expect(requireFreshAuthWithKey(ghost, 'whatever', keyOpts)).rejects.toThrow(
      /no password hash/
    );
  });
});
