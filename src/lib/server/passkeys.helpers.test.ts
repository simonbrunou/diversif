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

import { RP_ID, isOriginAllowedForRPID, publicPasskey } from './passkeys';
import { seedPasskey, seedUser } from './passkeys-test-fixtures';

beforeEach(async () => {
  await resetTestDb();
  mocks.generateRegistrationOptions.mockReset();
  mocks.verifyRegistrationResponse.mockReset();
  mocks.generateAuthenticationOptions.mockReset();
  mocks.verifyAuthenticationResponse.mockReset();
});

describe('RP_ID', () => {
  it('defaults to the hosted registrable domain', () => {
    // Sanity check: a bare hostname with no scheme and no subdomain.
    expect(RP_ID).toBe('diversif.app');
    expect(RP_ID).not.toMatch(/\//);
    expect(RP_ID).not.toMatch(/:/);
  });

  it('accepts the RP ID host and subdomains, but rejects unrelated hosts', () => {
    expect(isOriginAllowedForRPID('https://diversif.app')).toBe(true);
    expect(isOriginAllowedForRPID('https://preview.diversif.app')).toBe(true);
    expect(isOriginAllowedForRPID('https://example.com')).toBe(false);
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
