import { beforeEach, describe, expect, it, mock } from 'bun:test';

// The module under test dynamic-imports @simplewebauthn/browser; swap it for
// a reconfigurable stub so each test can control the ceremony outcome.
let startAuthenticationImpl: (opts: unknown) => Promise<unknown> = async () => ({});
mock.module('@simplewebauthn/browser', () => ({
  startAuthentication: (opts: unknown) => startAuthenticationImpl(opts)
}));

import { authenticateWithPasskey } from './passkey-client';

type FakeResponse = { ok: boolean; json: () => Promise<unknown> };

function fakeFetch(routes: {
  options: FakeResponse;
  verify?: FakeResponse;
}): typeof fetch & { calls: { url: string; init?: RequestInit }[] } {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url === '/passkeys/authentication/options') return routes.options;
    if (url === '/passkeys/authentication/verify') return routes.verify;
    throw new Error(`unexpected fetch: ${url}`);
  }) as unknown as typeof fetch & { calls: { url: string; init?: RequestInit }[] };
  fn.calls = calls;
  return fn;
}

beforeEach(() => {
  startAuthenticationImpl = async () => ({ id: 'assertion' });
});

describe('authenticateWithPasskey', () => {
  it('returns ok on a successful ceremony and posts the assertion to verify', async () => {
    const fetchFn = fakeFetch({
      options: { ok: true, json: async () => ({ challenge: 'c' }) },
      verify: { ok: true, json: async () => ({ ok: true }) }
    });
    const result = await authenticateWithPasskey(fetchFn);
    expect(result).toEqual({ ok: true });
    expect(fetchFn.calls.map((c) => c.url)).toEqual([
      '/passkeys/authentication/options',
      '/passkeys/authentication/verify'
    ]);
    const verifyCall = fetchFn.calls[1]!;
    expect(verifyCall.init?.method).toBe('POST');
    expect(JSON.parse(String(verifyCall.init?.body))).toEqual({
      response: { id: 'assertion' }
    });
  });

  it('reports errorsAccountPasskeyAuthStartFailed when the options fetch fails', async () => {
    const fetchFn = fakeFetch({ options: { ok: false, json: async () => ({}) } });
    const result = await authenticateWithPasskey(fetchFn);
    expect(result).toEqual({ ok: false, errorKey: 'errorsAccountPasskeyAuthStartFailed' });
  });

  it('reports errorsAccountPasskeyAuthFailed with the server message when verify fails', async () => {
    const fetchFn = fakeFetch({
      options: { ok: true, json: async () => ({}) },
      verify: { ok: false, json: async () => ({ ok: false, error: 'Clé inconnue.' }) }
    });
    const result = await authenticateWithPasskey(fetchFn);
    expect(result).toEqual({
      ok: false,
      errorKey: 'errorsAccountPasskeyAuthFailed',
      serverError: 'Clé inconnue.'
    });
  });

  it('reports errorsAccountPasskeyAuthFailed without serverError when verify returns ok:false', async () => {
    const fetchFn = fakeFetch({
      options: { ok: true, json: async () => ({}) },
      verify: { ok: true, json: async () => ({ ok: false }) }
    });
    const result = await authenticateWithPasskey(fetchFn);
    expect(result).toEqual({
      ok: false,
      errorKey: 'errorsAccountPasskeyAuthFailed',
      serverError: undefined
    });
  });

  it('tolerates a verify response with an unparsable body', async () => {
    const fetchFn = fakeFetch({
      options: { ok: true, json: async () => ({}) },
      verify: {
        ok: true,
        json: async () => {
          throw new Error('invalid JSON');
        }
      }
    });
    const result = await authenticateWithPasskey(fetchFn);
    expect(result).toEqual({
      ok: false,
      errorKey: 'errorsAccountPasskeyAuthFailed',
      serverError: undefined
    });
  });

  it('returns errorKey null when the user cancels (NotAllowedError name)', async () => {
    startAuthenticationImpl = async () => {
      const err = new Error('The operation either timed out or was not allowed.');
      err.name = 'NotAllowedError';
      throw err;
    };
    const fetchFn = fakeFetch({ options: { ok: true, json: async () => ({}) } });
    const result = await authenticateWithPasskey(fetchFn);
    expect(result).toEqual({ ok: false, errorKey: null });
  });

  it('returns errorKey null when the wrapped message mentions cancellation', async () => {
    startAuthenticationImpl = async () => {
      throw new Error('Ceremony was cancelled by the user');
    };
    const fetchFn = fakeFetch({ options: { ok: true, json: async () => ({}) } });
    const result = await authenticateWithPasskey(fetchFn);
    expect(result).toEqual({ ok: false, errorKey: null });
  });

  it('maps other thrown Errors to errorsAccountPasskeyGenericError', async () => {
    startAuthenticationImpl = async () => {
      throw new Error('boom');
    };
    const fetchFn = fakeFetch({ options: { ok: true, json: async () => ({}) } });
    const result = await authenticateWithPasskey(fetchFn);
    expect(result).toEqual({ ok: false, errorKey: 'errorsAccountPasskeyGenericError' });
  });

  it('maps non-Error throws to errorsAccountPasskeyGenericError', async () => {
    startAuthenticationImpl = async () => {
      throw 'string failure';
    };
    const fetchFn = fakeFetch({ options: { ok: true, json: async () => ({}) } });
    const result = await authenticateWithPasskey(fetchFn);
    expect(result).toEqual({ ok: false, errorKey: 'errorsAccountPasskeyGenericError' });
  });
});
