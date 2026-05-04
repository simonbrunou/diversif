import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';

vi.mock('$lib/server/db', () => ({ db: testDb }));

const mocks = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn()
}));

vi.mock('@simplewebauthn/server', () => mocks);

import {
  PASSKEY_CHALLENGE_TTL_MS,
  RP_NAME,
  buildAuthenticationOptions,
  buildRegistrationOptions,
  consumeChallenge,
  createChallenge,
  deletePasskey,
  findPasskey,
  finishAuthentication,
  finishRegistration,
  listPasskeys,
  originFromEnv,
  publicPasskey,
  purgeExpiredChallenges,
  renamePasskey,
  rpIdFromOrigin
} from './passkeys';
import { passkeys, users, webauthnChallenges } from './db/schema';
import { eq } from 'drizzle-orm';

beforeEach(() => {
  resetTestDb();
  mocks.generateRegistrationOptions.mockReset();
  mocks.verifyRegistrationResponse.mockReset();
  mocks.generateAuthenticationOptions.mockReset();
  mocks.verifyAuthenticationResponse.mockReset();
});

async function seedUser() {
  return testDb
    .insert(users)
    .values({
      email: 'parent@example.com',
      passwordHash: 'h',
      displayName: 'Parent',
      createdAt: new Date()
    })
    .returning()
    .all()[0];
}

function seedPasskey(userId: number, overrides: Partial<typeof passkeys.$inferInsert> = {}) {
  return testDb
    .insert(passkeys)
    .values({
      id: overrides.id ?? 'cred-id',
      userId,
      publicKey: overrides.publicKey ?? 'cHVi', // base64url for "pub"
      counter: overrides.counter ?? 0,
      transports: overrides.transports ?? '["internal"]',
      deviceType: overrides.deviceType ?? 'singleDevice',
      backedUp: overrides.backedUp ?? false,
      name: overrides.name ?? 'Test Key',
      createdAt: overrides.createdAt ?? new Date(),
      lastUsedAt: overrides.lastUsedAt ?? null
    })
    .returning()
    .get();
}

describe('rpIdFromOrigin', () => {
  it('returns the hostname for a valid URL', () => {
    expect(rpIdFromOrigin('https://example.com')).toBe('example.com');
    expect(rpIdFromOrigin('https://app.example.com:8443/foo')).toBe('app.example.com');
  });
  it('returns localhost on a malformed value', () => {
    expect(rpIdFromOrigin('not-a-url')).toBe('localhost');
  });
});

describe('originFromEnv', () => {
  it('prefers the ORIGIN env var', () => {
    const orig = process.env.ORIGIN;
    process.env.ORIGIN = 'https://from-env.test';
    try {
      expect(originFromEnv('https://fallback.test')).toBe('https://from-env.test');
    } finally {
      if (orig === undefined) delete process.env.ORIGIN;
      else process.env.ORIGIN = orig;
    }
  });
  it('falls back when ORIGIN is unset', () => {
    const orig = process.env.ORIGIN;
    delete process.env.ORIGIN;
    try {
      expect(originFromEnv('https://fallback.test')).toBe('https://fallback.test');
    } finally {
      if (orig !== undefined) process.env.ORIGIN = orig;
    }
  });
});

describe('challenges', () => {
  it('creates and consumes a challenge', async () => {
    const u = await seedUser();
    const c = createChallenge({ challenge: 'abc', purpose: 'registration', userId: u.id });
    expect(c.token).toMatch(/^[0-9a-f]+$/);
    expect(c.challenge).toBe('abc');
    expect(c.expiresAt.getTime()).toBeGreaterThan(Date.now());

    const consumed = consumeChallenge(c.token, 'registration');
    expect(consumed).toEqual({ challenge: 'abc', userId: u.id });

    // Token is single-use.
    expect(consumeChallenge(c.token, 'registration')).toBeNull();
  });

  it('createChallenge defaults missing userId to null', () => {
    const c = createChallenge({ challenge: 'x', purpose: 'authentication' });
    const row = testDb
      .select()
      .from(webauthnChallenges)
      .where(eq(webauthnChallenges.token, c.token))
      .get();
    expect(row?.userId).toBeNull();
  });

  it('returns null for an empty token', () => {
    expect(consumeChallenge('', 'registration')).toBeNull();
  });

  it('returns null for the wrong purpose', () => {
    const c = createChallenge({ challenge: 'x', purpose: 'registration', userId: null });
    expect(consumeChallenge(c.token, 'authentication')).toBeNull();
  });

  it('purges expired challenges and ignores them', () => {
    const past = new Date(Date.now() - 1000);
    testDb
      .insert(webauthnChallenges)
      .values({
        token: 'expired',
        challenge: 'x',
        purpose: 'registration',
        userId: null,
        expiresAt: past
      })
      .run();

    expect(consumeChallenge('expired', 'registration')).toBeNull();

    purgeExpiredChallenges();
    const stillThere = testDb
      .select()
      .from(webauthnChallenges)
      .where(eq(webauthnChallenges.token, 'expired'))
      .get();
    expect(stillThere).toBeUndefined();
  });

  it('exposes the challenge TTL', () => {
    expect(PASSKEY_CHALLENGE_TTL_MS).toBeGreaterThan(0);
  });
});

describe('listPasskeys / findPasskey / deletePasskey / renamePasskey', () => {
  it('lists, finds, renames, and deletes', async () => {
    const u = await seedUser();
    const other = await testDb
      .insert(users)
      .values({
        email: 'b@example.com',
        passwordHash: 'h',
        displayName: 'B',
        createdAt: new Date()
      })
      .returning()
      .all();
    seedPasskey(u.id, { id: 'a' });
    seedPasskey(u.id, { id: 'b', name: 'Other Key' });
    seedPasskey(other[0].id, { id: 'c' });

    expect(
      listPasskeys(u.id)
        .map((p) => p.id)
        .sort()
    ).toEqual(['a', 'b']);
    expect(findPasskey('a')?.id).toBe('a');
    expect(findPasskey('missing')).toBeUndefined();

    expect(renamePasskey(u.id, 'a', '  My Phone  ')).toBe(true);
    expect(findPasskey('a')?.name).toBe('My Phone');

    // Empty name rejected.
    expect(renamePasskey(u.id, 'a', '   ')).toBe(false);

    // Wrong owner cannot rename or delete.
    expect(renamePasskey(other[0].id, 'a', 'Hijack')).toBe(false);
    expect(deletePasskey(other[0].id, 'a')).toBe(false);

    // Unknown id.
    expect(renamePasskey(u.id, 'nope', 'X')).toBe(false);
    expect(deletePasskey(u.id, 'nope')).toBe(false);

    expect(deletePasskey(u.id, 'a')).toBe(true);
    expect(findPasskey('a')).toBeUndefined();
  });

  it('truncates very long names on rename', async () => {
    const u = await seedUser();
    seedPasskey(u.id, { id: 'a' });
    const long = 'x'.repeat(200);
    expect(renamePasskey(u.id, 'a', long)).toBe(true);
    expect(findPasskey('a')?.name.length).toBe(80);
  });
});

describe('buildRegistrationOptions', () => {
  it('passes the right RP context and excludes existing credentials', async () => {
    const u = await seedUser();
    seedPasskey(u.id, { id: 'existing', transports: '["usb","internal"]' });

    mocks.generateRegistrationOptions.mockResolvedValue({ challenge: 'ch' });

    await buildRegistrationOptions({
      userId: u.id,
      email: u.email,
      displayName: u.displayName,
      rpID: 'example.com'
    });

    expect(mocks.generateRegistrationOptions).toHaveBeenCalledTimes(1);
    const args = mocks.generateRegistrationOptions.mock.calls[0][0];
    expect(args.rpName).toBe(RP_NAME);
    expect(args.rpID).toBe('example.com');
    expect(args.userName).toBe(u.email);
    expect(args.userDisplayName).toBe(u.displayName);
    expect(args.excludeCredentials).toEqual([{ id: 'existing', transports: ['usb', 'internal'] }]);
  });

  it('handles malformed transports json gracefully', async () => {
    const u = await seedUser();
    seedPasskey(u.id, { id: 'existing', transports: 'not-json' });
    mocks.generateRegistrationOptions.mockResolvedValue({ challenge: 'ch' });
    await buildRegistrationOptions({
      userId: u.id,
      email: u.email,
      displayName: u.displayName,
      rpID: 'example.com'
    });
    const args = mocks.generateRegistrationOptions.mock.calls[0][0];
    expect(args.excludeCredentials[0].transports).toEqual([]);
  });

  it('drops non-string transport entries', async () => {
    const u = await seedUser();
    seedPasskey(u.id, { id: 'existing', transports: '[1,"usb",null]' });
    mocks.generateRegistrationOptions.mockResolvedValue({ challenge: 'ch' });
    await buildRegistrationOptions({
      userId: u.id,
      email: u.email,
      displayName: u.displayName,
      rpID: 'example.com'
    });
    const args = mocks.generateRegistrationOptions.mock.calls[0][0];
    expect(args.excludeCredentials[0].transports).toEqual(['usb']);
  });

  it('treats non-array json as empty', async () => {
    const u = await seedUser();
    seedPasskey(u.id, { id: 'existing', transports: '"oops"' });
    mocks.generateRegistrationOptions.mockResolvedValue({ challenge: 'ch' });
    await buildRegistrationOptions({
      userId: u.id,
      email: u.email,
      displayName: u.displayName,
      rpID: 'example.com'
    });
    const args = mocks.generateRegistrationOptions.mock.calls[0][0];
    expect(args.excludeCredentials[0].transports).toEqual([]);
  });
});

describe('buildAuthenticationOptions', () => {
  it('forwards the rpID and prefers user verification', async () => {
    mocks.generateAuthenticationOptions.mockResolvedValue({ challenge: 'ch' });
    await buildAuthenticationOptions({ rpID: 'example.com' });
    expect(mocks.generateAuthenticationOptions).toHaveBeenCalledWith({
      rpID: 'example.com',
      userVerification: 'preferred'
    });
  });
});

describe('finishRegistration', () => {
  function makeResponse(transports?: string[]) {
    return {
      id: 'cred-id',
      response: { transports }
    } as unknown as Parameters<typeof finishRegistration>[0]['response'];
  }

  it('persists a verified credential', async () => {
    const u = await seedUser();
    mocks.verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'new-cred',
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 7
        },
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: true
      }
    });

    const result = await finishRegistration({
      userId: u.id,
      response: { id: 'new-cred', response: { transports: ['internal'] } } as never,
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com',
      name: '  '
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.passkey.id).toBe('new-cred');
    expect(result.passkey.counter).toBe(7);
    expect(result.passkey.deviceType).toBe('multiDevice');
    expect(result.passkey.backedUp).toBe(true);
    // Empty name falls back to "Passkey".
    expect(result.passkey.name).toBe('Passkey');
    expect(result.passkey.transports).toBe('["internal"]');
  });

  it('defaults transports to []', async () => {
    const u = await seedUser();
    mocks.verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: 'new-cred',
          publicKey: new Uint8Array([1]),
          counter: 0
        },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false
      }
    });
    const result = await finishRegistration({
      userId: u.id,
      response: makeResponse(),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com',
      name: 'My Key'
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.passkey.transports).toBe('[]');
    expect(result.passkey.name).toBe('My Key');
  });

  it('rejects duplicate credential ids', async () => {
    const u = await seedUser();
    seedPasskey(u.id, { id: 'dup' });
    mocks.verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: { id: 'dup', publicKey: new Uint8Array([1]), counter: 0 },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false
      }
    });
    const result = await finishRegistration({
      userId: u.id,
      response: makeResponse(),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com',
      name: 'Dup'
    });
    expect(result.ok).toBe(false);
  });

  it('returns the verifier error message', async () => {
    const u = await seedUser();
    mocks.verifyRegistrationResponse.mockRejectedValue(new Error('boom'));
    const result = await finishRegistration({
      userId: u.id,
      response: makeResponse(),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com',
      name: 'X'
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('boom');
  });

  it('returns a fallback message when the thrown value is not an Error', async () => {
    const u = await seedUser();
    mocks.verifyRegistrationResponse.mockRejectedValue('nope');
    const result = await finishRegistration({
      userId: u.id,
      response: makeResponse(),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com',
      name: 'X'
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Verification failed');
  });

  it('returns an error when not verified', async () => {
    const u = await seedUser();
    mocks.verifyRegistrationResponse.mockResolvedValue({ verified: false });
    const result = await finishRegistration({
      userId: u.id,
      response: makeResponse(),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com',
      name: 'X'
    });
    expect(result.ok).toBe(false);
  });
});

describe('finishAuthentication', () => {
  function authResponse(id = 'cred-id') {
    return { id } as unknown as Parameters<typeof finishAuthentication>[0]['response'];
  }

  it('updates counter, lastUsedAt, and backedUp on success', async () => {
    const u = await seedUser();
    seedPasskey(u.id);
    mocks.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: 'cred-id',
        newCounter: 12,
        userVerified: true,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: true,
        origin: 'https://example.com',
        rpID: 'example.com'
      }
    });

    const result = await finishAuthentication({
      response: authResponse(),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com'
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.passkey.counter).toBe(12);
    expect(result.passkey.backedUp).toBe(true);
    expect(result.passkey.lastUsedAt).toBeInstanceOf(Date);
    expect(result.userId).toBe(u.id);
  });

  it('rejects unknown credentials', async () => {
    const result = await finishAuthentication({
      response: authResponse('missing'),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com'
    });
    expect(result.ok).toBe(false);
  });

  it('cascades deletion when the owning user is removed', async () => {
    const u = await seedUser();
    seedPasskey(u.id);
    testDb.delete(users).where(eq(users.id, u.id)).run();
    // FK cascade should have removed the passkey row.
    const result = await finishAuthentication({
      response: authResponse(),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com'
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Clé inconnue.');
  });

  it('returns the verifier error message', async () => {
    const u = await seedUser();
    seedPasskey(u.id);
    mocks.verifyAuthenticationResponse.mockRejectedValue(new Error('bad'));
    const result = await finishAuthentication({
      response: authResponse(),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com'
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('bad');
  });

  it('returns the fallback when thrown value is not an Error', async () => {
    const u = await seedUser();
    seedPasskey(u.id);
    mocks.verifyAuthenticationResponse.mockRejectedValue('nope');
    const result = await finishAuthentication({
      response: authResponse(),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com'
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Verification failed');
  });

  it('rejects when not verified', async () => {
    const u = await seedUser();
    seedPasskey(u.id);
    mocks.verifyAuthenticationResponse.mockResolvedValue({ verified: false });
    const result = await finishAuthentication({
      response: authResponse(),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com'
    });
    expect(result.ok).toBe(false);
  });

  it('passes the stored transports to the verifier', async () => {
    const u = await seedUser();
    seedPasskey(u.id, { transports: '["usb"]' });
    mocks.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: 'cred-id',
        newCounter: 1,
        userVerified: true,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
        origin: 'https://example.com',
        rpID: 'example.com'
      }
    });
    await finishAuthentication({
      response: authResponse(),
      expectedChallenge: 'ch',
      expectedOrigin: 'https://example.com',
      expectedRPID: 'example.com'
    });
    expect(mocks.verifyAuthenticationResponse.mock.calls[0][0].credential.transports).toEqual([
      'usb'
    ]);
  });
});

describe('publicPasskey', () => {
  it('includes the timestamps as numbers', async () => {
    const u = await seedUser();
    const created = new Date(2024, 0, 1);
    const used = new Date(2024, 5, 1);
    const p = seedPasskey(u.id, { createdAt: created, lastUsedAt: used });
    const out = publicPasskey(p);
    expect(out).toEqual({
      id: 'cred-id',
      name: 'Test Key',
      deviceType: 'singleDevice',
      backedUp: false,
      createdAt: created.getTime(),
      lastUsedAt: used.getTime()
    });
  });

  it('handles a never-used passkey', async () => {
    const u = await seedUser();
    const p = seedPasskey(u.id);
    expect(publicPasskey(p).lastUsedAt).toBeNull();
  });
});
