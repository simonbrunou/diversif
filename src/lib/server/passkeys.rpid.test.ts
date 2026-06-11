// RP_ID is resolved from WEBAUTHN_RP_ID once, at module load. The per-file
// test runner gives every test file a fresh process, so setting the env var
// BEFORE importing the module is the only way to exercise the custom-RP_ID
// path (passkeys.helpers.test.ts covers the unset/default path, and
// passkeys.rpid-invalid.test.ts the rejection path).
import { describe, expect, it, mock } from 'bun:test';
import { testDb } from '../../test/db';

mock.module('$lib/server/db', () => ({ db: testDb }));

// Set BEFORE the dynamic import below — a static import would be hoisted
// above this assignment and read the default RP ID instead.
process.env.WEBAUTHN_RP_ID = '  Sous.Example.ORG ';

const { RP_ID, isOriginAllowedForRPID } = await import('./passkeys');

describe('RP_ID with WEBAUTHN_RP_ID set', () => {
  it('trims and lowercases a valid bare hostname', () => {
    expect(RP_ID).toBe('sous.example.org');
  });

  it('scopes origin checks to the configured RP ID', () => {
    expect(isOriginAllowedForRPID('https://sous.example.org')).toBe(true);
    expect(isOriginAllowedForRPID('https://app.sous.example.org')).toBe(true);
    expect(isOriginAllowedForRPID('https://diversif.app')).toBe(false);
  });
});
