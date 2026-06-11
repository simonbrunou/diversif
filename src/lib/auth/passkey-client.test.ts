import { beforeEach, describe, expect, it, mock } from 'bun:test';

// The module under test dynamic-imports @simplewebauthn/browser; swap it for
// a reconfigurable stub so each test can control the ceremony outcome.
let startAuthenticationImpl: (opts: unknown) => Promise<unknown> = async () => ({});
mock.module('@simplewebauthn/browser', () => ({
  startAuthentication: (opts: unknown) => startAuthenticationImpl(opts)
}));
// The default showError lazily imports svelte-sonner; mock it so the default
// branch is exercisable without resolving the real package (its nested runed
// dep only exports the `svelte` condition, absent in this runner).
let toastErrorCalls: string[] = [];
mock.module('svelte-sonner', () => ({
  toast: { error: (message: string) => toastErrorCalls.push(message) }
}));

import { authenticateWithPasskey, signInWithPasskey } from './passkey-client';

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

  it('reports errorsAccountPasskeyAuthFailed when verify fails (server message ignored)', async () => {
    const fetchFn = fakeFetch({
      options: { ok: true, json: async () => ({}) },
      verify: { ok: false, json: async () => ({ ok: false, error: 'Clé inconnue.' }) }
    });
    const result = await authenticateWithPasskey(fetchFn);
    expect(result).toEqual({ ok: false, errorKey: 'errorsAccountPasskeyAuthFailed' });
  });

  it('reports errorsAccountPasskeyAuthFailed when verify returns ok:false', async () => {
    const fetchFn = fakeFetch({
      options: { ok: true, json: async () => ({}) },
      verify: { ok: true, json: async () => ({ ok: false }) }
    });
    const result = await authenticateWithPasskey(fetchFn);
    expect(result).toEqual({ ok: false, errorKey: 'errorsAccountPasskeyAuthFailed' });
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
    expect(result).toEqual({ ok: false, errorKey: 'errorsAccountPasskeyAuthFailed' });
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

describe('signInWithPasskey', () => {
  it('navigates home on success and flips the busy flag around the flow', async () => {
    const busy: boolean[] = [];
    const navigate = mock(() => Promise.resolve());
    await signInWithPasskey((v) => busy.push(v), {
      authenticate: async () => ({ ok: true }),
      navigate: navigate as never,
      showError: () => {}
    });
    expect(busy).toEqual([true, false]);
    expect(navigate).toHaveBeenCalledWith('/', { invalidateAll: true });
  });

  it('surfaces the resolved errorKey message on failure', async () => {
    const shown: string[] = [];
    await signInWithPasskey(() => {}, {
      authenticate: async () => ({ ok: false, errorKey: 'errorsAccountPasskeyAuthFailed' }),
      navigate: (() => Promise.resolve()) as never,
      showError: (message) => shown.push(message)
    });
    const { errorsAccountPasskeyAuthFailed } = await import('$lib/paraglide/messages');
    expect(shown).toEqual([errorsAccountPasskeyAuthFailed()]);
  });

  it('default showError lazily toasts via svelte-sonner', async () => {
    toastErrorCalls = [];
    await signInWithPasskey(() => {}, {
      authenticate: async () => ({ ok: false, errorKey: 'errorsAccountPasskeyGenericError' }),
      navigate: (() => Promise.resolve()) as never
    });
    // The default showError fires-and-forgets a dynamic import; flush it.
    await new Promise((resolve) => setTimeout(resolve, 0));
    const { errorsAccountPasskeyGenericError } = await import('$lib/paraglide/messages');
    expect(toastErrorCalls).toEqual([errorsAccountPasskeyGenericError()]);
  });

  it('stays silent on user cancellation', async () => {
    const shown: string[] = [];
    const navigate = mock(() => Promise.resolve());
    await signInWithPasskey(() => {}, {
      authenticate: async () => ({ ok: false, errorKey: null }),
      navigate: navigate as never,
      showError: (message) => shown.push(message)
    });
    expect(shown).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('resets the busy flag even when navigation throws', async () => {
    const busy: boolean[] = [];
    await expect(
      signInWithPasskey((v) => busy.push(v), {
        authenticate: async () => ({ ok: true }),
        navigate: (() => Promise.reject(new Error('nav aborted'))) as never,
        showError: () => {}
      })
    ).rejects.toThrow('nav aborted');
    expect(busy).toEqual([true, false]);
  });
});
