// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

import { clear, enqueue, flush, pendingCount } from './queue';

const goodActionResult = (location = '/child/1?logged=1') =>
  new Response(JSON.stringify({ type: 'redirect', location }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const failureActionResult = (status: number, data: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ type: 'failure', status, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const errorActionResult = (status: number) =>
  new Response(JSON.stringify({ type: 'error', error: { message: 'boom', status } }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const networkFailure = () => Promise.reject(new TypeError('Failed to fetch'));

describe('queue', () => {
  beforeEach(async () => {
    await clear();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await clear();
  });

  it('enqueue persists a row and updates pendingCount', async () => {
    expect(get(pendingCount)).toBe(0);
    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: '2026-01-01T00:00:00Z' },
      queuedAt: 1
    });
    expect(get(pendingCount)).toBe(1);
  });

  it('flush posts each row and removes them on type:redirect', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult());

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: '2026-01-01T00:00:00Z' },
      queuedAt: 1
    });
    await enqueue({
      key: 'k2',
      childId: 1,
      formData: { foodId: '2', reaction: 'ras', givenAt: '2026-01-02T00:00:00Z' },
      queuedAt: 2
    });

    await flush();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const firstCall = fetchSpy.mock.calls[0];
    expect(firstCall[0]).toBe('/child/1/log');
    const init = firstCall[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('k1');
    expect((init.headers as Record<string, string>)['x-sveltekit-action']).toBe('true');
    expect(get(pendingCount)).toBe(0);
  });

  it('processes rows in queuedAt order', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult());

    await enqueue({
      key: 'late',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 2
    });
    await enqueue({
      key: 'early',
      childId: 1,
      formData: { foodId: '2', reaction: 'ras', givenAt: 'y' },
      queuedAt: 1
    });

    await flush();

    const headersOfCall = (i: number) =>
      (fetchSpy.mock.calls[i][1] as RequestInit).headers as Record<string, string>;
    expect(headersOfCall(0)['Idempotency-Key']).toBe('early');
    expect(headersOfCall(1)['Idempotency-Key']).toBe('late');
  });

  it('leaves the row queued on a network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(networkFailure);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(get(pendingCount)).toBe(1);
  });

  it('leaves the row queued on type:error 5xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorActionResult(503));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(get(pendingCount)).toBe(1);
  });

  it('leaves the row queued on type:failure status 409', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(failureActionResult(409));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(get(pendingCount)).toBe(1);
  });

  it('drops the row and emits drop event on type:failure 4xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(failureActionResult(400, { error: 'bad' }));
    const events: string[] = [];
    const off = window.addEventListener('queue:dropped', () => events.push('dropped'));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(get(pendingCount)).toBe(0);
    expect(events).toContain('dropped');
    window.removeEventListener('queue:dropped', off as EventListener);
  });

  it('drops the row and emits sessionExpired on type:redirect to /login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult('/login'));
    const events: string[] = [];
    const handler = () => events.push('expired');
    window.addEventListener('queue:sessionExpired', handler);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(get(pendingCount)).toBe(0);
    expect(events).toContain('expired');
    window.removeEventListener('queue:sessionExpired', handler);
  });

  it('treats /en/login (paraglide locale prefix) the same as /login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult('/en/login'));
    const events: string[] = [];
    const handler = () => events.push('expired');
    window.addEventListener('queue:sessionExpired', handler);

    await enqueue({
      key: 'k1-en',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(get(pendingCount)).toBe(0);
    expect(events).toContain('expired');
    window.removeEventListener('queue:sessionExpired', handler);
  });

  it('also fires sessionExpired on /en/login?next=...', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult('/en/login?next=/child/1'));
    const events: string[] = [];
    const handler = () => events.push('expired');
    window.addEventListener('queue:sessionExpired', handler);

    await enqueue({
      key: 'k1-en-qs',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(get(pendingCount)).toBe(0);
    expect(events).toContain('expired');
    window.removeEventListener('queue:sessionExpired', handler);
  });

  it('emits queue:synced with milestone qs on success', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      goodActionResult('/child/1?logged=1&first=1&categories=2&prevCategories=1')
    );
    const detail: unknown[] = [];
    const handler = (e: Event) => detail.push((e as CustomEvent).detail);
    window.addEventListener('queue:synced', handler);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(detail).toEqual([{ childId: 1, qs: 'logged=1&first=1&categories=2&prevCategories=1' }]);
    window.removeEventListener('queue:synced', handler);
  });

  it('flush is reentrant-safe', async () => {
    let resolveFetch: ((r: Response) => void) | undefined;
    let fetchInvoked: () => void = () => {};
    const fetchWasInvoked = new Promise<void>((res) => {
      fetchInvoked = res;
    });
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((res) => {
          resolveFetch = res;
          fetchInvoked();
        })
    );

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    const p1 = flush();
    const p2 = flush();
    // tx() now resolves on transaction.oncomplete (after the merge), which
    // takes a few microtasks longer than fn()'s synchronous resolution. Wait
    // until fetch is actually invoked before resolving the response, so
    // resolveFetch is guaranteed populated.
    await fetchWasInvoked;
    resolveFetch!(goodActionResult());
    await Promise.all([p1, p2]);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('leaves the row queued on type:error with no status (defaults to 500)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ type: 'error', error: { message: 'boom' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(get(pendingCount)).toBe(1);
  });

  it('leaves the row queued when response body is not valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not-json', { status: 200, headers: { 'content-type': 'text/plain' } })
    );

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(get(pendingCount)).toBe(1);
  });

  it('drops the row and emits drop event on type:error 4xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(errorActionResult(422));
    const events: string[] = [];
    const handler = () => events.push('dropped');
    window.addEventListener('queue:dropped', handler);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(get(pendingCount)).toBe(0);
    expect(events).toContain('dropped');
    window.removeEventListener('queue:dropped', handler);
  });

  it('enqueue rejects when indexedDB.open fires onerror', async () => {
    // Cover the req.onerror path in openDb() and reqAsPromise() by injecting
    // a fake IDBOpenDBRequest that fires onerror instead of onsuccess.
    const fakeError = new DOMException('IDB open failed', 'UnknownError');
    const openSpy = vi.spyOn(globalThis.indexedDB, 'open').mockImplementation(() => {
      const fakeReq = {
        result: null,
        error: fakeError,
        readyState: 'pending',
        onupgradeneeded: null as ((e: IDBVersionChangeEvent) => void) | null,
        onsuccess: null as ((e: Event) => void) | null,
        onerror: null as ((e: Event) => void) | null,
        onblocked: null as ((e: IDBVersionChangeEvent) => void) | null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false
      } as unknown as IDBOpenDBRequest;
      // Fire onerror asynchronously so handlers can be attached first.
      Promise.resolve().then(() => fakeReq.onerror?.(new Event('error')));
      return fakeReq;
    });

    await expect(
      enqueue({
        key: 'err1',
        childId: 1,
        formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
        queuedAt: 1
      })
    ).rejects.toBe(fakeError);

    openSpy.mockRestore();
  });

  it('enqueue rejects when IDBRequest fires onerror (covers reqAsPromise onerror)', async () => {
    // Cover the req.onerror path in reqAsPromise() by injecting a fake IDBRequest
    // that fires onerror. We intercept indexedDB.open to return a real DB, then
    // wrap db.transaction so that the store's put() returns an erroring request.
    const fakeReqError = new DOMException('ConstraintError', 'ConstraintError');
    const realOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB);

    vi.spyOn(globalThis.indexedDB, 'open').mockImplementationOnce((...args) => {
      const openReq = realOpen(...(args as Parameters<typeof realOpen>));
      // After the real open succeeds, wrap db.transaction once.
      openReq.addEventListener('success', () => {
        const db = openReq.result as IDBDatabase;
        const realTxFn = db.transaction.bind(db);
        vi.spyOn(db, 'transaction').mockImplementationOnce((...txArgs) => {
          const realTransaction = realTxFn(...(txArgs as Parameters<typeof realTxFn>));
          const realObjectStore = realTransaction.objectStore.bind(realTransaction);
          vi.spyOn(realTransaction, 'objectStore').mockImplementationOnce((name) => {
            const realStore = realObjectStore(name);
            // Replace put() with one that returns an immediately-erroring IDBRequest.
            vi.spyOn(realStore, 'put').mockImplementationOnce(() => {
              const fakeReq = {
                result: undefined,
                error: fakeReqError,
                source: realStore,
                transaction: realTransaction,
                readyState: 'pending' as IDBRequestReadyState,
                onsuccess: null as ((e: Event) => void) | null,
                onerror: null as ((e: Event) => void) | null,
                addEventListener: (_: string, cb: EventListenerOrEventListenerObject) => {
                  if (_ === 'error' && typeof cb === 'function') {
                    Promise.resolve().then(() => cb(new Event('error')));
                  }
                },
                removeEventListener: () => {},
                dispatchEvent: () => false
              } as unknown as IDBRequest;
              Promise.resolve().then(() => fakeReq.onerror?.(new Event('error')));
              return fakeReq;
            });
            return realStore;
          });
          return realTransaction;
        });
      });
      return openReq;
    });

    await expect(
      enqueue({
        key: 'reqerr',
        childId: 1,
        formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
        queuedAt: 1
      })
    ).rejects.toBeDefined();
  });

  it('exposes pending rows after a fresh module load (cross-tab persistence)', async () => {
    // Seed IDB directly without going through enqueue, simulating a previous
    // tab session that wrote to IDB.
    const dbReq = indexedDB.open('diversif-offline', 1);
    const db = await new Promise<IDBDatabase>((res, rej) => {
      dbReq.onupgradeneeded = () => {
        const d = dbReq.result;
        if (!d.objectStoreNames.contains('log')) {
          const store = d.createObjectStore('log', { keyPath: 'key' });
          store.createIndex('queuedAt', 'queuedAt', { unique: false });
        }
      };
      dbReq.onsuccess = () => res(dbReq.result);
      dbReq.onerror = () => rej(dbReq.error);
    });
    await new Promise<void>((res, rej) => {
      const t = db.transaction('log', 'readwrite');
      t.objectStore('log').put({
        key: 'persisted',
        childId: 1,
        formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
        queuedAt: 1
      });
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    });
    db.close();

    // Re-import the module fresh (simulating tab reload)
    vi.resetModules();
    const fresh = await import('./queue');
    // Wait a tick for module init's refreshCount() to settle
    await new Promise((res) => setTimeout(res, 0));
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ type: 'redirect', location: '/child/1?logged=1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    await fresh.flush();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect((fetchSpy.mock.calls[0][1] as RequestInit).headers).toMatchObject({
      'Idempotency-Key': 'persisted'
    });
  });

  it('tx rejects when IDBTransaction fires onerror (covers transaction.onerror)', async () => {
    // Cover the transaction.onerror path in tx() by forcing the transaction to abort.
    // We intercept db.transaction to get the real transaction, then call abort() on it
    // asynchronously : fake-indexeddb fires onerror on abort when there is no pending
    // request suppressing it.
    const realOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB);

    vi.spyOn(globalThis.indexedDB, 'open').mockImplementationOnce((...args) => {
      const openReq = realOpen(...(args as Parameters<typeof realOpen>));
      openReq.addEventListener('success', () => {
        const db = openReq.result as IDBDatabase;
        const realTxFn = db.transaction.bind(db);
        vi.spyOn(db, 'transaction').mockImplementationOnce((...txArgs) => {
          const realTransaction = realTxFn(...(txArgs as Parameters<typeof realTxFn>));
          // Abort the transaction after one microtask : this causes transaction.onerror
          // (or transaction.onabort) to fire on the transaction object.
          Promise.resolve().then(() => {
            try {
              realTransaction.abort();
            } catch {
              /* already committed */
            }
          });
          return realTransaction;
        });
      });
      return openReq;
    });

    await expect(
      enqueue({
        key: 'txaborterr',
        childId: 1,
        formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
        queuedAt: 1
      })
    ).rejects.toBeDefined();
  });
});
