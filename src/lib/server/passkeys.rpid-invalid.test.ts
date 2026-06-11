// Counterpart to passkeys.rpid.test.ts: a malformed WEBAUTHN_RP_ID must make
// the module refuse to load (fail-fast at boot rather than issuing passkey
// ceremonies scoped to a broken RP ID). Module evaluation happens once per
// process, so this lives in its own file to get a fresh import.
import { describe, expect, it, mock } from 'bun:test';
import { testDb } from '../../test/db';

mock.module('$lib/server/db', () => ({ db: testDb }));

process.env.WEBAUTHN_RP_ID = 'example.org.';

describe('RP_ID with a malformed WEBAUTHN_RP_ID', () => {
  it('rejects values that are not a bare hostname at module load', async () => {
    await expect(import('./passkeys')).rejects.toThrow(
      'WEBAUTHN_RP_ID must be a bare hostname such as diversif.app'
    );
  });
});
