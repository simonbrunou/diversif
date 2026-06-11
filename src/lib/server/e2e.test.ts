import { afterEach, describe, expect, it } from 'bun:test';
import { isE2E } from './e2e';

const ORIG_E2E = process.env.E2E;
const ORIG_ORIGIN = process.env.ORIGIN;

function setEnv(e2e: string | undefined, origin: string | undefined) {
  if (e2e === undefined) delete process.env.E2E;
  else process.env.E2E = e2e;
  if (origin === undefined) delete process.env.ORIGIN;
  else process.env.ORIGIN = origin;
}

afterEach(() => {
  setEnv(ORIG_E2E, ORIG_ORIGIN);
});

describe('isE2E', () => {
  it('is true for the Playwright webServer shape (E2E=1 + localhost ORIGIN)', () => {
    setEnv('1', 'http://localhost:4173');
    expect(isE2E()).toBe(true);
  });

  it('accepts 127.0.0.1 as loopback, with or without a port', () => {
    setEnv('1', 'http://127.0.0.1:5000');
    expect(isE2E()).toBe(true);
    setEnv('1', 'http://localhost');
    expect(isE2E()).toBe(true);
  });

  it('is false without E2E=1, even on localhost (dev server)', () => {
    setEnv(undefined, 'http://localhost:4173');
    expect(isE2E()).toBe(false);
    setEnv('0', 'http://localhost:4173');
    expect(isE2E()).toBe(false);
  });

  it('is false for a stray E2E=1 in production-like environments', () => {
    // ORIGIN unset — the Docker image derives the origin from proxy headers.
    setEnv('1', undefined);
    expect(isE2E()).toBe(false);
    // ORIGIN set to a public https hostname.
    setEnv('1', 'https://diversif.app');
    expect(isE2E()).toBe(false);
    // https on localhost or sneaky lookalike hosts must not qualify either.
    setEnv('1', 'https://localhost:4173');
    expect(isE2E()).toBe(false);
    setEnv('1', 'http://localhost.evil.example');
    expect(isE2E()).toBe(false);
  });
});
