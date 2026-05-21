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

import { originFromEnv, publicPasskey, rpIdFromOrigin } from './passkeys';
import { seedPasskey, seedUser } from './passkeys-test-fixtures';

beforeEach(async () => {
  await resetTestDb();
  mocks.generateRegistrationOptions.mockReset();
  mocks.verifyRegistrationResponse.mockReset();
  mocks.generateAuthenticationOptions.mockReset();
  mocks.verifyAuthenticationResponse.mockReset();
});

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
  it('strips trailing slashes and surrounding whitespace', () => {
    const orig = process.env.ORIGIN;
    process.env.ORIGIN = '  https://from-env.test/  ';
    try {
      expect(originFromEnv('https://fallback.test')).toBe('https://from-env.test');
    } finally {
      if (orig === undefined) delete process.env.ORIGIN;
      else process.env.ORIGIN = orig;
    }
  });
  it('also normalizes the fallback', () => {
    const orig = process.env.ORIGIN;
    delete process.env.ORIGIN;
    try {
      expect(originFromEnv('https://fallback.test///')).toBe('https://fallback.test');
    } finally {
      if (orig !== undefined) process.env.ORIGIN = orig;
    }
  });
});

describe('publicPasskey', () => {
  it('includes the timestamps as numbers', async () => {
    const u = await seedUser();
    const created = new Date(2024, 0, 1);
    const used = new Date(2024, 5, 1);
    const p = await seedPasskey(u.id, { createdAt: created, lastUsedAt: used });
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
    const p = await seedPasskey(u.id);
    expect(publicPasskey(p).lastUsedAt).toBeNull();
  });
});
