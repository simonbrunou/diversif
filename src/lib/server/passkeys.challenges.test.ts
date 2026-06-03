import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';

mock.module('$lib/server/db', () => ({ db: testDb }));

const mocks = {
  generateRegistrationOptions: mock(),
  verifyRegistrationResponse: mock(),
  generateAuthenticationOptions: mock(),
  verifyAuthenticationResponse: mock()
};

mock.module('@simplewebauthn/server', () => mocks);

import {
  PASSKEY_CHALLENGE_TTL_MS,
  consumeChallenge,
  createChallenge,
  purgeExpiredChallenges
} from './passkeys';
import { webauthnChallenges } from './db/schema';
import { eq } from 'drizzle-orm';
import { seedUser } from './passkeys-test-fixtures';

beforeEach(async () => {
  await resetTestDb();
  mocks.generateRegistrationOptions.mockReset();
  mocks.verifyRegistrationResponse.mockReset();
  mocks.generateAuthenticationOptions.mockReset();
  mocks.verifyAuthenticationResponse.mockReset();
});

describe('challenges', () => {
  it('creates and consumes a challenge', async () => {
    const u = await seedUser();
    const c = await createChallenge({ challenge: 'abc', purpose: 'registration', userId: u.id });
    expect(c.token).toMatch(/^[0-9a-f]+$/);
    expect(c.challenge).toBe('abc');
    expect(c.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const consumed = await consumeChallenge(c.token, 'registration');
    expect(consumed).toEqual({ challenge: 'abc', userId: u.id });

    // Token is single-use.
    expect(await consumeChallenge(c.token, 'registration')).toBeNull();
  });

  it('createChallenge defaults missing userId to null', async () => {
    const c = await createChallenge({ challenge: 'x', purpose: 'authentication' });
    const row = (
      await testDb
        .select()
        .from(webauthnChallenges)
        .where(eq(webauthnChallenges.token, c.token))
        .limit(1)
    )[0];
    expect(row?.userId).toBeNull();
  });

  it('returns null for an empty token', async () => {
    expect(await consumeChallenge('', 'registration')).toBeNull();
  });

  it('returns null for the wrong purpose', async () => {
    const c = await createChallenge({ challenge: 'x', purpose: 'registration', userId: null });
    expect(await consumeChallenge(c.token, 'authentication')).toBeNull();
  });

  it('purges expired challenges and ignores them', async () => {
    const past = new Date(Date.now() - 1000);
    await testDb.insert(webauthnChallenges).values({
      token: 'expired',
      challenge: 'x',
      purpose: 'registration',
      userId: null,
      expiresAt: past
    });

    expect(await consumeChallenge('expired', 'registration')).toBeNull();

    await purgeExpiredChallenges();
    const stillThere = (
      await testDb
        .select()
        .from(webauthnChallenges)
        .where(eq(webauthnChallenges.token, 'expired'))
        .limit(1)
    )[0];
    expect(stillThere).toBeUndefined();
  });

  it('exposes the challenge TTL', () => {
    expect(PASSKEY_CHALLENGE_TTL_MS).toBeGreaterThan(0);
  });

  it('atomically consumes a challenge : concurrent verifies cannot both succeed', async () => {
    const c = await createChallenge({ challenge: 'x', purpose: 'registration', userId: null });

    const [first, second] = await Promise.all([
      consumeChallenge(c.token, 'registration'),
      consumeChallenge(c.token, 'registration')
    ]);

    const successes = [first, second].filter((r) => r !== null);
    expect(successes).toHaveLength(1);
    expect(successes[0]).toEqual({ challenge: 'x', userId: null });

    // The row is gone (the DELETE-RETURNING winner removed it; the loser
    // got nothing back, but the table reflects the same outcome).
    const stillThere = (
      await testDb
        .select()
        .from(webauthnChallenges)
        .where(eq(webauthnChallenges.token, c.token))
        .limit(1)
    )[0];
    expect(stillThere).toBeUndefined();
  });
});
