import { afterEach, describe, expect, it } from 'bun:test';
import { isE2E } from './e2e';

const ORIG_E2E = process.env.E2E;
const ORIG_ORIGIN = process.env.ORIGIN;
const globals = globalThis as { __BUILD_ORIGIN__: string };

function setEnv(e2e: string | undefined, buildOrigin: string) {
  if (e2e === undefined) delete process.env.E2E;
  else process.env.E2E = e2e;
  globals.__BUILD_ORIGIN__ = buildOrigin;
}

afterEach(() => {
  setEnv(ORIG_E2E, '');
  if (ORIG_ORIGIN === undefined) delete process.env.ORIGIN;
  else process.env.ORIGIN = ORIG_ORIGIN;
});

describe('isE2E', () => {
  it('is true for the Playwright webServer shape (E2E=1 + localhost build origin)', () => {
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

  it('is false for a stray E2E=1 in production-like builds', () => {
    // No build origin — the Docker image derives it from proxy headers.
    setEnv('1', '');
    expect(isE2E()).toBe(false);
    // Built for a public https hostname.
    setEnv('1', 'https://diversif.app');
    expect(isE2E()).toBe(false);
    // https on localhost or sneaky lookalike hosts must not qualify either.
    setEnv('1', 'https://localhost:4173');
    expect(isE2E()).toBe(false);
    setEnv('1', 'http://localhost.evil.example');
    expect(isE2E()).toBe(false);
  });

  it('ignores a leftover runtime ORIGIN, which adapter-node 6 no longer serves', () => {
    // A proxied production build with E2E=1 and the old runtime variable
    // still set must keep the strict limits: the server answers real https
    // traffic whatever ORIGIN says.
    setEnv('1', '');
    process.env.ORIGIN = 'http://localhost:3000';
    expect(isE2E()).toBe(false);
  });
});
