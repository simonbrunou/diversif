import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import 'fake-indexeddb/auto';

import { buildBody, clear, count, enqueue, flush, needsReauthCount } from './queue';

/** Count rows directly in IDB, bypassing the module's own count() export. */
async function countRows(): Promise<number> {
  const req = indexedDB.open('diversif-offline', 1);
  const db = await new Promise<IDBDatabase>((res, rej) => {
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('log')) {
        const store = d.createObjectStore('log', { keyPath: 'key' });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
      }
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  const n = await new Promise<number>((res, rej) => {
    const t = db.transaction('log', 'readonly');
    const r = t.objectStore('log').count();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  db.close();
  return n;
}

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

// Mirrors what the real server actually sends for a thrown action error:
// SvelteKit's handle_action_json_request puts the numeric status ONLY on
// the HTTP response (never in the JSON body), and this app's own
// hooks.server.ts:handleError strips the message down to a generic
// 'Internal Error' + errorId for every status < 500 — see the ActionError
// interface comment in queue.ts. A body-level `status` field, or an HTTP
// response hardcoded to 200 regardless of the intended status, would be a
// fictional envelope the real server can never produce.
const errorActionResult = (status: number) =>
  new Response(
    JSON.stringify({ type: 'error', error: { message: 'Internal Error', errorId: 'deadbeef' } }),
    {
      status,
      headers: { 'content-type': 'application/json' }
    }
  );

const networkFailure = () => Promise.reject(new TypeError('Failed to fetch'));

describe('queue', () => {
  beforeEach(async () => {
    await clear();
    mock.restore();
  });

  afterEach(async () => {
    await clear();
  });

  it('enqueue persists a row', async () => {
    expect(await countRows()).toBe(0);
    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: '2026-01-01T00:00:00Z' },
      queuedAt: 1
    });
    expect(await countRows()).toBe(1);
  });

  it('count() reports the number of rows still queued', async () => {
    expect(await count()).toBe(0);
    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await enqueue({
      key: 'k2',
      childId: 1,
      formData: { foodId: '2', reaction: 'ras', givenAt: 'x' },
      queuedAt: 2
    });
    expect(await count()).toBe(2);
  });

  it('emits queue:changed on enqueue, and again once flush drops the row', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult());
    const events: string[] = [];
    const handler = () => events.push('changed');
    window.addEventListener('queue:changed', handler);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    expect(events).toEqual(['changed']);

    await flush();
    expect(events).toEqual(['changed', 'changed']);
    expect(await count()).toBe(0);

    window.removeEventListener('queue:changed', handler);
  });

  it('buildBody expands array values into repeated params', () => {
    const body = buildBody({ foodId: ['1', '2'], reaction: 'ras' });
    expect(body.getAll('foodId')).toEqual(['1', '2']);
    expect(body.get('reaction')).toBe('ras');
  });

  it('flush posts each row and removes them on type:redirect', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult());

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
    expect(await countRows()).toBe(0);
  });

  it('processes rows in queuedAt order', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult());

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
    spyOn(globalThis, 'fetch').mockImplementation(networkFailure);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(1);
  });

  it('leaves the row queued on type:error 5xx', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(errorActionResult(503));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(1);
  });

  it('leaves the row queued on type:failure status 409', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(failureActionResult(409));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(1);
  });

  it('drops the row and emits drop event on type:failure 4xx', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(failureActionResult(400, { error: 'bad' }));
    const events: string[] = [];
    const off = window.addEventListener('queue:dropped', () => events.push('dropped'));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(0);
    expect(events).toContain('dropped');
    window.removeEventListener('queue:dropped', off as EventListener);
  });

  // Regression for F-P5 (#308): the row must survive a session-expiry
  // redirect — the action never ran, so deleting it would lose data the
  // parent typed with nothing to show for it. It's retained with
  // status:'needs-reauth' and surfaced via the persistent affordance
  // (queue:needsReauth + needsReauthCount()), not the one-shot toast the
  // old 'sessionExpired' event drove.
  it('retains the row (not dropped) and emits needsReauth on type:redirect to /login', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult('/login'));
    const events: unknown[] = [];
    const handler = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener('queue:needsReauth', handler);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(1);
    expect(await needsReauthCount()).toBe(1);
    expect(events).toEqual([{ key: 'k1' }]);
    window.removeEventListener('queue:needsReauth', handler);
  });

  it('treats /en/login (paraglide locale prefix) the same as /login', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult('/en/login'));
    const events: unknown[] = [];
    const handler = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener('queue:needsReauth', handler);

    await enqueue({
      key: 'k1-en',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(1);
    expect(await needsReauthCount()).toBe(1);
    expect(events).toEqual([{ key: 'k1-en' }]);
    window.removeEventListener('queue:needsReauth', handler);
  });

  it('also fires needsReauth on /en/login?next=...', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult('/en/login?next=/child/1'));
    const events: unknown[] = [];
    const handler = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener('queue:needsReauth', handler);

    await enqueue({
      key: 'k1-en-qs',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(1);
    expect(await needsReauthCount()).toBe(1);
    expect(events).toEqual([{ key: 'k1-en-qs' }]);
    window.removeEventListener('queue:needsReauth', handler);
  });

  it('does not re-mark or re-emit on a second flush while still needs-reauth (no queue:changed spam)', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult('/login'));
    const changed: number[] = [];
    const handler = () => changed.push(1);
    window.addEventListener('queue:changed', handler);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    changed.length = 0; // drop the enqueue's own queue:changed

    await flush(); // first pass: transitions to needs-reauth, emits once
    expect(changed).toEqual([1]);

    await flush(); // still logged out: same outcome, already marked — no-op
    expect(changed).toEqual([1]);
    expect(await countRows()).toBe(1);

    window.removeEventListener('queue:changed', handler);
  });

  it('processes a later, different row in the same pass instead of stopping at the first needs-reauth row', async () => {
    // Guards against re-introducing 'retry'-style break-the-loop semantics
    // for needs-reauth, which would wedge every row queued after the first
    // session-expired one until it happens to succeed.
    spyOn(globalThis, 'fetch').mockResolvedValue(goodActionResult('/login'));

    await enqueue({
      key: 'first',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await enqueue({
      key: 'second',
      childId: 1,
      formData: { foodId: '2', reaction: 'ras', givenAt: 'y' },
      queuedAt: 2
    });

    await flush();

    expect(await countRows()).toBe(2);
    expect(await needsReauthCount()).toBe(2);
  });

  it('a successful replay after re-authentication clears a needs-reauth row', async () => {
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValueOnce(goodActionResult('/login'));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(); // marks needs-reauth, retained
    expect(await countRows()).toBe(1);
    expect(await needsReauthCount()).toBe(1);

    // Simulate the user re-authenticating: the next replay succeeds.
    fetchSpy.mockResolvedValue(goodActionResult());
    await flush();

    expect(await countRows()).toBe(0);
    expect(await needsReauthCount()).toBe(0);
  });

  it('emits queue:synced with milestone qs on success', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(
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
    spyOn(globalThis, 'fetch').mockImplementation(
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

  it('leaves the row queued on type:error with a real HTTP 500 (unhandled server exception)', async () => {
    // Regression for #307's review: the real server never puts a `status`
    // field in the error body (hooks.server.ts:handleError always returns
    // `{ message: 'Internal Error', errorId }`) — only the HTTP response
    // itself carries the real status. errorActionResult(500) reproduces
    // exactly that shape.
    spyOn(globalThis, 'fetch').mockResolvedValue(errorActionResult(500));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(1);
  });

  it('leaves the row queued when response body is not valid JSON', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not-json', { status: 200, headers: { 'content-type': 'text/plain' } })
    );

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(1);
  });

  it('drops the row and emits drop event on type:error 4xx', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(errorActionResult(422));
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

    expect(await countRows()).toBe(0);
    expect(events).toContain('dropped');
    window.removeEventListener('queue:dropped', handler);
  });

  // Regression for F-P6 (#307): requireChildContext rejects a queued
  // replay with 401/403/404 when the child was deleted or this user's
  // access was revoked while the entry sat offline. That must be
  // distinguishable from every other 4xx (malformed request, etc.) so the
  // parent gets an explanatory message instead of the generic drop toast.
  it('drops the row and emits accessRevoked (not dropped) on type:error 403', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(errorActionResult(403));
    const droppedEvents: string[] = [];
    const revokedEvents: unknown[] = [];
    const onDropped = () => droppedEvents.push('dropped');
    const onRevoked = (e: Event) => revokedEvents.push((e as CustomEvent).detail);
    window.addEventListener('queue:dropped', onDropped);
    window.addEventListener('queue:accessRevoked', onRevoked);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(0);
    expect(droppedEvents).toEqual([]);
    expect(revokedEvents).toEqual([{ status: 403 }]);
    window.removeEventListener('queue:dropped', onDropped);
    window.removeEventListener('queue:accessRevoked', onRevoked);
  });

  it('drops the row and emits accessRevoked (not dropped) on type:error 404', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(errorActionResult(404));
    const droppedEvents: string[] = [];
    const revokedEvents: unknown[] = [];
    const onDropped = () => droppedEvents.push('dropped');
    const onRevoked = (e: Event) => revokedEvents.push((e as CustomEvent).detail);
    window.addEventListener('queue:dropped', onDropped);
    window.addEventListener('queue:accessRevoked', onRevoked);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(0);
    expect(droppedEvents).toEqual([]);
    expect(revokedEvents).toEqual([{ status: 404 }]);
    window.removeEventListener('queue:dropped', onDropped);
    window.removeEventListener('queue:accessRevoked', onRevoked);
  });

  it('drops the row and emits accessRevoked (not dropped) on type:failure 401', async () => {
    spyOn(globalThis, 'fetch').mockResolvedValue(failureActionResult(401));
    const droppedEvents: string[] = [];
    const revokedEvents: unknown[] = [];
    const onDropped = () => droppedEvents.push('dropped');
    const onRevoked = (e: Event) => revokedEvents.push((e as CustomEvent).detail);
    window.addEventListener('queue:dropped', onDropped);
    window.addEventListener('queue:accessRevoked', onRevoked);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush();

    expect(await countRows()).toBe(0);
    expect(droppedEvents).toEqual([]);
    expect(revokedEvents).toEqual([{ status: 401 }]);
    window.removeEventListener('queue:dropped', onDropped);
    window.removeEventListener('queue:accessRevoked', onRevoked);
  });

  it('enqueue rejects when indexedDB.open fires onerror', async () => {
    // Cover the req.onerror path in openDb() and reqAsPromise() by injecting
    // a fake IDBOpenDBRequest that fires onerror instead of onsuccess.
    const fakeError = new DOMException('IDB open failed', 'UnknownError');
    const openSpy = spyOn(globalThis.indexedDB, 'open').mockImplementation(() => {
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

    spyOn(globalThis.indexedDB, 'open').mockImplementationOnce((...args) => {
      const openReq = realOpen(...(args as Parameters<typeof realOpen>));
      // After the real open succeeds, wrap db.transaction once.
      openReq.addEventListener('success', () => {
        const db = openReq.result as IDBDatabase;
        const realTxFn = db.transaction.bind(db);
        spyOn(db, 'transaction').mockImplementationOnce((...txArgs) => {
          const realTransaction = realTxFn(...(txArgs as Parameters<typeof realTxFn>));
          const realObjectStore = realTransaction.objectStore.bind(realTransaction);
          spyOn(realTransaction, 'objectStore').mockImplementationOnce((name) => {
            const realStore = realObjectStore(name);
            // Replace put() with one that returns an immediately-erroring IDBRequest.
            spyOn(realStore, 'put').mockImplementationOnce(() => {
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

    // Re-import the module fresh (simulating tab reload).
    // bun:test has no equivalent to vi.resetModules() — ESM has no userland
    // cache invalidation. For this test the persistent IDB state is what
    // matters: the post-close re-import returns the same module instance,
    // but the queue's in-memory state is reset by reading fresh from IDB.
    const fresh = await import('./queue');
    const fetchSpy = spyOn(globalThis, 'fetch').mockResolvedValue(
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

    spyOn(globalThis.indexedDB, 'open').mockImplementationOnce((...args) => {
      const openReq = realOpen(...(args as Parameters<typeof realOpen>));
      openReq.addEventListener('success', () => {
        const db = openReq.result as IDBDatabase;
        const realTxFn = db.transaction.bind(db);
        spyOn(db, 'transaction').mockImplementationOnce((...txArgs) => {
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
