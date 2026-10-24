import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import 'fake-indexeddb/auto';

import { rawRows } from '../../test/offline-db';
import { clear, count, enqueue, flush, needsReauthCount } from './queue';
import type { Transport } from './wire';

/** Count rows directly in IDB, bypassing the module's own count() export. */
async function countRows(): Promise<number> {
  return (await rawRows()).length;
}

/**
 * A transport that answers every replay with `answer()` and records what was
 * posted. The answers are hand-built envelopes for the statuses the real
 * action can't easily produce; queue.replay.test.ts replays against the real
 * action instead.
 */
function server(answer: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit; body: URLSearchParams }[] = [];
  const transport: Transport = async (url, init) => {
    calls.push({ url, init, body: new URLSearchParams(String(init.body)) });
    return answer();
  };
  return { transport, calls };
}

/** Like server(), answering the calls in turn. */
function serverAnswering(...answers: (() => Response)[]) {
  let call = 0;
  return server(() => answers[call++]());
}

// Every tab must take the flush lock under this name for one tab's pass to
// make the others skip theirs.
const FLUSH_LOCK = 'diversif-offline-flush';

/**
 * A stand-in for navigator.locks with the Web Locks rules flush() relies on:
 * one exclusive lock per name, a request with ifAvailable gets null while
 * another holder has that lock, and any other request waits for it.
 * holdElsewhere() takes a lock the way another tab's pass would and returns
 * the function that releases it, resolving once the lock is free.
 */
function webLocks() {
  const holders = new Map<string, Promise<unknown>>();
  const request = async (
    name: string,
    options: LockOptions,
    callback: (lock: Lock | null) => unknown
  ): Promise<unknown> => {
    if (holders.has(name) && options.ifAvailable) return callback(null);
    while (holders.has(name)) await holders.get(name)?.catch(() => {});
    const run = (async () => callback({ name, mode: 'exclusive' }))();
    holders.set(name, run);
    try {
      return await run;
    } finally {
      holders.delete(name);
    }
  };
  return {
    manager: { request } as unknown as LockManager,
    holdElsewhere(name: string): () => Promise<void> {
      const { promise, resolve } = Promise.withResolvers<void>();
      const released = request(name, {}, () => promise);
      return async () => {
        resolve();
        await released;
      };
    }
  };
}

const goodActionResult = (location = '/child/1?logged=1') =>
  new Response(JSON.stringify({ type: 'redirect', location }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });

const failureActionResult = (status: number) =>
  new Response(JSON.stringify({ type: 'failure', status }), {
    status,
    headers: { 'content-type': 'application/json' }
  });

// Mirrors what the real server actually sends for a thrown action error:
// SvelteKit's handle_action_json_request puts the numeric status ONLY on
// the HTTP response (never in the JSON body), and this app's own
// hooks.server.ts:handleError strips the message down to a generic
// 'Internal Error' + errorId for every status < 500.
const errorActionResult = (status: number) =>
  new Response(
    JSON.stringify({ type: 'error', error: { message: 'Internal Error', errorId: 'deadbeef' } }),
    {
      status,
      headers: { 'content-type': 'application/json' }
    }
  );

const networkFailure = (): Response => {
  throw new TypeError('Failed to fetch');
};

/** A fake IDBOpenDBRequest that fires onerror instead of onsuccess. */
function failingOpenRequest(error: DOMException): IDBOpenDBRequest {
  const fakeReq = {
    result: null,
    error,
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
}

describe('queue', () => {
  beforeEach(async () => {
    await clear();
  });

  afterEach(async () => {
    await clear();
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
    const { transport } = server(() => goodActionResult());
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

    await flush(transport);
    expect(events).toEqual(['changed', 'changed']);
    expect(await count()).toBe(0);

    window.removeEventListener('queue:changed', handler);
  });

  it('flush posts each row as an action request carrying its key, and removes it on type:redirect', async () => {
    const { transport, calls } = server(() => goodActionResult());

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: ['1', '3'], reaction: 'ras', givenAt: '2026-01-01T00:00:00Z' },
      queuedAt: 1
    });
    await enqueue({
      key: 'k2',
      childId: 1,
      formData: { foodId: '2', reaction: 'ras', givenAt: '2026-01-02T00:00:00Z' },
      queuedAt: 2
    });

    await flush(transport);

    expect(calls).toHaveLength(2);
    expect(calls[0].url).toBe('/child/1/log');
    expect(calls[0].init.method).toBe('POST');
    expect((calls[0].init.headers as Record<string, string>)['x-sveltekit-action']).toBe('true');
    expect(calls[0].body.get('idempotencyKey')).toBe('k1');
    expect(calls[0].body.getAll('foodId')).toEqual(['1', '3']);
    expect(await countRows()).toBe(0);
  });

  it('processes rows in queuedAt order', async () => {
    const { transport, calls } = server(() => goodActionResult());

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

    await flush(transport);

    expect(calls.map((c) => c.body.get('idempotencyKey'))).toEqual(['early', 'late']);
  });

  it('leaves the row queued on a network failure', async () => {
    const { transport } = server(networkFailure);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(transport);

    expect(await countRows()).toBe(1);
  });

  it('leaves the row queued on type:error 5xx', async () => {
    const { transport } = server(() => errorActionResult(503));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(transport);

    expect(await countRows()).toBe(1);
  });

  it('leaves the row queued on type:failure status 409', async () => {
    const { transport } = server(() => failureActionResult(409));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(transport);

    expect(await countRows()).toBe(1);
  });

  it('drops the row and emits drop event on type:failure 4xx', async () => {
    const { transport } = server(() => failureActionResult(400));
    const events: string[] = [];
    const handler = () => events.push('dropped');
    window.addEventListener('queue:dropped', handler);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(transport);

    expect(await countRows()).toBe(0);
    expect(events).toContain('dropped');
    window.removeEventListener('queue:dropped', handler);
  });

  // Regression for F-P5 (#308): the row must survive a session-expiry
  // redirect — the action never ran, so deleting it would lose data the
  // parent typed with nothing to show for it. It's retained with
  // status:'needs-reauth' and surfaced via the persistent affordance
  // (queue:needsReauth + needsReauthCount()), not the one-shot toast the
  // old 'sessionExpired' event drove.
  it('retains the row (not dropped) and emits needsReauth on type:redirect to /login', async () => {
    const { transport } = server(() => goodActionResult('/login'));
    const events: unknown[] = [];
    const handler = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener('queue:needsReauth', handler);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(transport);

    expect(await countRows()).toBe(1);
    expect(await needsReauthCount()).toBe(1);
    expect(events).toEqual([{ key: 'k1' }]);
    window.removeEventListener('queue:needsReauth', handler);
  });

  it('treats /en/login (paraglide locale prefix) the same as /login', async () => {
    const { transport } = server(() => goodActionResult('/en/login'));
    const events: unknown[] = [];
    const handler = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener('queue:needsReauth', handler);

    await enqueue({
      key: 'k1-en',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(transport);

    expect(await countRows()).toBe(1);
    expect(await needsReauthCount()).toBe(1);
    expect(events).toEqual([{ key: 'k1-en' }]);
    window.removeEventListener('queue:needsReauth', handler);
  });

  it('also fires needsReauth on /en/login?next=...', async () => {
    const { transport } = server(() => goodActionResult('/en/login?next=/child/1'));
    const events: unknown[] = [];
    const handler = (e: Event) => events.push((e as CustomEvent).detail);
    window.addEventListener('queue:needsReauth', handler);

    await enqueue({
      key: 'k1-en-qs',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(transport);

    expect(await countRows()).toBe(1);
    expect(await needsReauthCount()).toBe(1);
    expect(events).toEqual([{ key: 'k1-en-qs' }]);
    window.removeEventListener('queue:needsReauth', handler);
  });

  it('does not re-mark or re-emit on a second flush while still needs-reauth (no queue:changed spam)', async () => {
    const { transport } = server(() => goodActionResult('/login'));
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

    await flush(transport); // first pass: transitions to needs-reauth, emits once
    expect(changed).toEqual([1]);

    await flush(transport); // still logged out: same outcome, already marked — no-op
    expect(changed).toEqual([1]);
    expect(await countRows()).toBe(1);

    window.removeEventListener('queue:changed', handler);
  });

  it('processes a later, different row in the same pass instead of stopping at the first needs-reauth row', async () => {
    // Guards against re-introducing 'retry'-style break-the-loop semantics
    // for needs-reauth, which would wedge every row queued after the first
    // session-expired one until it happens to succeed.
    const { transport } = server(() => goodActionResult('/login'));

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

    await flush(transport);

    expect(await countRows()).toBe(2);
    expect(await needsReauthCount()).toBe(2);
  });

  it('a successful replay after re-authentication clears a needs-reauth row', async () => {
    let location = '/login';
    const { transport } = server(() => goodActionResult(location));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(transport); // marks needs-reauth, retained
    expect(await countRows()).toBe(1);
    expect(await needsReauthCount()).toBe(1);

    // Simulate the user re-authenticating: the next replay succeeds.
    location = '/child/1?logged=1';
    await flush(transport);

    expect(await countRows()).toBe(0);
    expect(await needsReauthCount()).toBe(0);
  });

  it('emits queue:synced with milestone qs on success', async () => {
    const { transport } = server(() =>
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
    await flush(transport);

    expect(detail).toEqual([{ queryStrings: ['logged=1&first=1&categories=2&prevCategories=1'] }]);
    window.removeEventListener('queue:synced', handler);
  });

  it('announces one queue:synced per flush, only once the replayed rows are deleted', async () => {
    const { transport } = serverAnswering(
      () => goodActionResult('/child/1?logged=1&first=1'),
      () => goodActionResult('/child/1?logged=1&categories=1&prevCategories=1')
    );
    const detail: unknown[] = [];
    const rowsLeftAtEmit: Promise<number>[] = [];
    const handler = (e: Event) => {
      detail.push((e as CustomEvent).detail);
      rowsLeftAtEmit.push(countRows());
    };
    window.addEventListener('queue:synced', handler);

    await enqueue({ key: 'k1', childId: 1, formData: { foodId: '1' }, queuedAt: 1 });
    await enqueue({ key: 'k2', childId: 1, formData: { foodId: '2' }, queuedAt: 2 });
    await flush(transport);

    expect(detail).toEqual([
      { queryStrings: ['logged=1&first=1', 'logged=1&categories=1&prevCategories=1'] }
    ]);
    expect(await Promise.all(rowsLeftAtEmit)).toEqual([0]);
    window.removeEventListener('queue:synced', handler);
  });

  it('announces only the rows replayed before a retry stopped the pass', async () => {
    const { transport } = serverAnswering(
      () => goodActionResult('/child/1?logged=1&first=1'),
      networkFailure
    );
    const detail: unknown[] = [];
    const handler = (e: Event) => detail.push((e as CustomEvent).detail);
    window.addEventListener('queue:synced', handler);

    await enqueue({ key: 'k1', childId: 1, formData: { foodId: '1' }, queuedAt: 1 });
    await enqueue({ key: 'k2', childId: 1, formData: { foodId: '2' }, queuedAt: 2 });
    await flush(transport);

    expect(detail).toEqual([{ queryStrings: ['logged=1&first=1'] }]);
    expect(await countRows()).toBe(1);
    window.removeEventListener('queue:synced', handler);
  });

  it('announces a replayed row only once it is deleted, so a failed delete cannot celebrate twice', async () => {
    // The replay returns the same redirect both times, as the server's
    // idempotency cache does for a re-sent key.
    const { transport } = server(() => goodActionResult('/child/1?logged=1&first=1'));
    const detail: unknown[] = [];
    const handler = (e: Event) => detail.push((e as CustomEvent).detail);
    window.addEventListener('queue:synced', handler);
    await enqueue({ key: 'k1', childId: 1, formData: { foodId: '1' }, queuedAt: 1 });

    // flush() opens the database twice: to read the rows, then to delete the
    // replayed one. Only the delete fails.
    const fakeError = new DOMException('IDB open failed', 'UnknownError');
    const realOpen = globalThis.indexedDB.open.bind(globalThis.indexedDB);
    let opens = 0;
    const openSpy = spyOn(globalThis.indexedDB, 'open').mockImplementation((...args) =>
      ++opens === 1
        ? realOpen(...(args as Parameters<typeof realOpen>))
        : failingOpenRequest(fakeError)
    );
    // Not expect(...).rejects, which can hang the file: see docs/agents/testing.md.
    const error = await flush(transport).catch((e: unknown) => e);
    openSpy.mockRestore();
    expect(error).toBe(fakeError);

    expect(detail).toEqual([]);
    expect(await countRows()).toBe(1);

    await flush(transport);
    expect(detail).toEqual([{ queryStrings: ['logged=1&first=1'] }]);
    expect(await countRows()).toBe(0);
    window.removeEventListener('queue:synced', handler);
  });

  it('runs a pass of its own for a flush started from a queue:synced listener', async () => {
    // The first pass replays k1, then stops on k2's 409. The pass has ended
    // by the time it announces k1, so a flush from the listener replays k2.
    const { transport, calls } = serverAnswering(
      () => goodActionResult(),
      () => failureActionResult(409),
      () => goodActionResult()
    );
    let fromListener: Promise<void> | undefined;
    const handler = () => {
      fromListener ??= flush(transport);
    };
    window.addEventListener('queue:synced', handler);

    await enqueue({ key: 'k1', childId: 1, formData: { foodId: '1' }, queuedAt: 1 });
    await enqueue({ key: 'k2', childId: 1, formData: { foodId: '2' }, queuedAt: 2 });
    await flush(transport);
    await fromListener;

    expect(calls.map((c) => c.body.get('idempotencyKey'))).toEqual(['k1', 'k2', 'k2']);
    expect(await countRows()).toBe(0);
    window.removeEventListener('queue:synced', handler);
  });

  it('does not announce queue:synced when no row replayed', async () => {
    const { transport } = server(() => failureActionResult(400));
    let synced = 0;
    const handler = () => synced++;
    window.addEventListener('queue:synced', handler);

    await enqueue({ key: 'k1', childId: 1, formData: { foodId: '1' }, queuedAt: 1 });
    await flush(transport);

    expect(synced).toBe(0);
    window.removeEventListener('queue:synced', handler);
  });

  it.each([
    ['/en/child/1?logged=1&first=1', 'logged=1&first=1'],
    ['/child/1', '']
  ])('reads the query string of the success redirect %s', async (location, queryString) => {
    const { transport } = server(() => goodActionResult(location));
    const detail: unknown[] = [];
    const handler = (e: Event) => detail.push((e as CustomEvent).detail);
    window.addEventListener('queue:synced', handler);

    await enqueue({ key: 'k1', childId: 1, formData: { foodId: '1' }, queuedAt: 1 });
    await flush(transport);

    expect(detail).toEqual([{ queryStrings: [queryString] }]);
    window.removeEventListener('queue:synced', handler);
  });

  it('flush is reentrant-safe', async () => {
    let resolveFetch: ((r: Response) => void) | undefined;
    let fetchInvoked: () => void = () => {};
    const fetchWasInvoked = new Promise<void>((res) => {
      fetchInvoked = res;
    });
    const { transport, calls } = server(
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
    const p1 = flush(transport);
    const p2 = flush(transport);
    // tx() now resolves on transaction.oncomplete (after the merge), which
    // takes a few microtasks longer than fn()'s synchronous resolution. Wait
    // until the request is actually sent before resolving the response, so
    // resolveFetch is guaranteed populated.
    await fetchWasInvoked;
    resolveFetch!(goodActionResult());
    await Promise.all([p1, p2]);

    expect(calls).toHaveLength(1);
  });

  it('leaves the row queued on type:error with a real HTTP 500 (unhandled server exception)', async () => {
    // Regression for #307's review: the real server never puts a `status`
    // field in the error body (hooks.server.ts:handleError always returns
    // `{ message: 'Internal Error', errorId }`) — only the HTTP response
    // itself carries the real status. errorActionResult(500) reproduces
    // exactly that shape.
    const { transport } = server(() => errorActionResult(500));

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(transport);

    expect(await countRows()).toBe(1);
  });

  it('leaves the row queued when response body is not valid JSON', async () => {
    const { transport } = server(
      () => new Response('not-json', { status: 200, headers: { 'content-type': 'text/plain' } })
    );

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(transport);

    expect(await countRows()).toBe(1);
  });

  it('leaves the row queued when a hook answered before the action ran, even with a 4xx', async () => {
    // SvelteKit's answer when a hook throws: an App.Error with no action
    // `type`. Not the action's verdict on the row, so the row stays.
    for (const status of [500, 403]) {
      const { transport } = server(
        () =>
          new Response(JSON.stringify({ status, message: 'Internal Error' }), {
            status,
            headers: { 'content-type': 'application/json' }
          })
      );
      await enqueue({
        key: `hook-${status}`,
        childId: 1,
        formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
        queuedAt: 1
      });
      await flush(transport);

      expect(await countRows()).toBe(1);
      await clear();
    }
  });

  it('drops the row and emits drop event on type:error 4xx', async () => {
    const { transport } = server(() => errorActionResult(422));
    const events: string[] = [];
    const handler = () => events.push('dropped');
    window.addEventListener('queue:dropped', handler);

    await enqueue({
      key: 'k1',
      childId: 1,
      formData: { foodId: '1', reaction: 'ras', givenAt: 'x' },
      queuedAt: 1
    });
    await flush(transport);

    expect(await countRows()).toBe(0);
    expect(events).toContain('dropped');
    window.removeEventListener('queue:dropped', handler);
  });

  // Regression for F-P6 (#307): requireChildContext rejects a queued
  // replay with 401/403/404 when the child was deleted or this user's
  // access was revoked while the entry sat offline. That must be
  // distinguishable from every other 4xx (malformed request, etc.) so the
  // parent gets an explanatory message instead of the generic drop toast.
  for (const [type, status] of [
    ['error', 403],
    ['error', 404],
    ['failure', 401]
  ] as const) {
    it(`drops the row and emits accessRevoked (not dropped) on type:${type} ${status}`, async () => {
      const { transport } = server(() =>
        type === 'error' ? errorActionResult(status) : failureActionResult(status)
      );
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
      await flush(transport);

      expect(await countRows()).toBe(0);
      expect(droppedEvents).toEqual([]);
      expect(revokedEvents).toEqual([{ status }]);
      window.removeEventListener('queue:dropped', onDropped);
      window.removeEventListener('queue:accessRevoked', onRevoked);
    });
  }

  it('enqueue rejects when indexedDB.open fires onerror', async () => {
    // Cover the req.onerror path in openDb() and reqAsPromise() by injecting
    // a fake IDBOpenDBRequest that fires onerror instead of onsuccess.
    const fakeError = new DOMException('IDB open failed', 'UnknownError');
    const openSpy = spyOn(globalThis.indexedDB, 'open').mockImplementation(() =>
      failingOpenRequest(fakeError)
    );

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

  // Every open tab flushes on reconnect, and the in-tab inFlight guard can't
  // see the other tabs: both replayed the same rows and toasted them twice
  // (#452). happy-dom's navigator.locks is null, the no-Web-Locks browser the
  // tests above run as; these install a stand-in.
  describe('with Web Locks', () => {
    let locks: ReturnType<typeof webLocks>;
    const otherTabTryLock = () =>
      navigator.locks.request(FLUSH_LOCK, { ifAvailable: true }, (lock) => lock);

    beforeEach(() => {
      locks = webLocks();
      Object.defineProperty(navigator, 'locks', { value: locks.manager, configurable: true });
    });

    afterEach(() => {
      Reflect.deleteProperty(navigator, 'locks');
    });

    it('skips its pass while another tab is flushing, then replays once that tab is done', async () => {
      // Four rows whose replays, once the lock is free, fire every event
      // flush() can emit: synced, dropped, accessRevoked and needsReauth,
      // each with its queue:changed.
      const { transport, calls } = serverAnswering(
        () => goodActionResult('/child/1?logged=1&first=1'),
        () => failureActionResult(422),
        () => failureActionResult(403),
        () => goodActionResult('/login')
      );
      const names = [
        'queue:changed',
        'queue:synced',
        'queue:dropped',
        'queue:accessRevoked',
        'queue:needsReauth'
      ];
      const events: string[] = [];
      const handler = (e: Event) => events.push(e.type);
      for (let i = 1; i <= 4; i++) {
        await enqueue({ key: `k${i}`, childId: 1, formData: { foodId: '1' }, queuedAt: i });
      }
      for (const name of names) window.addEventListener(name, handler);

      const releaseOtherTab = locks.holdElsewhere(FLUSH_LOCK);
      await flush(transport);

      expect(calls).toHaveLength(0);
      expect(events).toEqual([]);
      expect(await countRows()).toBe(4);

      await releaseOtherTab();
      await flush(transport);

      expect(calls).toHaveLength(4);
      expect([...new Set(events)].sort()).toEqual([...names].sort());
      // The needs-reauth row stays queued.
      expect(await countRows()).toBe(1);
      for (const name of names) window.removeEventListener(name, handler);
    });

    it('holds the lock until its pass ends, so another tab skips meanwhile', async () => {
      const sent = Promise.withResolvers<void>();
      const answer = Promise.withResolvers<Response>();
      const { transport } = server(() => {
        sent.resolve();
        return answer.promise;
      });
      await enqueue({ key: 'k1', childId: 1, formData: { foodId: '1' }, queuedAt: 1 });

      const pass = flush(transport);
      try {
        await sent.promise;
        expect(await otherTabTryLock()).toBeNull();
      } finally {
        // Ends the pass even when the check fails, so the tests after this
        // one don't get its pending promise back from flush().
        answer.resolve(goodActionResult());
        await pass;
      }
      expect(await otherTabTryLock()).not.toBeNull();
    });

    it('hands a second flush in the same tab the running pass instead of skipping', async () => {
      const sent = Promise.withResolvers<void>();
      const answer = Promise.withResolvers<Response>();
      const { transport, calls } = server(() => {
        sent.resolve();
        return answer.promise;
      });
      await enqueue({ key: 'k1', childId: 1, formData: { foodId: '1' }, queuedAt: 1 });

      const first = flush(transport);
      await sent.promise;
      const second = flush(transport);
      answer.resolve(goodActionResult());
      await second;

      // The second call settles only once the running pass has replayed the row.
      expect(await countRows()).toBe(0);
      expect(calls).toHaveLength(1);
      await first;
    });

    it('rejects and frees the lock when its pass throws', async () => {
      const fakeError = new DOMException('IDB open failed', 'UnknownError');
      const openSpy = spyOn(globalThis.indexedDB, 'open').mockImplementation(() =>
        failingOpenRequest(fakeError)
      );
      const { transport, calls } = server(() => goodActionResult());

      // Not expect(...).rejects, which can hang the file: see docs/agents/testing.md.
      const error = await flush(transport).catch((e: unknown) => e);
      openSpy.mockRestore();
      expect(error).toBe(fakeError);

      expect(await otherTabTryLock()).not.toBeNull();
      await enqueue({ key: 'k1', childId: 1, formData: { foodId: '1' }, queuedAt: 1 });
      await flush(transport);
      expect(calls).toHaveLength(1);
    });
  });
});
