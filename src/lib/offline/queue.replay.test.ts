import { beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import 'fake-indexeddb/auto';

import { testDb, resetTestDb } from '../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../test/route';

// Same bootstrap as the route-level action tests (e.g.
// log.idempotency.test.ts): point $lib/server/db at the in-process
// bun:sqlite instance before the action module (which imports it) loads.
mock.module('$lib/server/db', () => ({ db: testDb }));
mock.module('$lib/server/audit', () => ({ audit: mock() }));

import { eq, sql } from 'drizzle-orm';
import { foodEntries, foods } from '$lib/server/db/schema';
import { actions } from '../../routes/child/[id]/log/+page.server';
import { clear, count, enqueue, flush } from './queue';

/**
 * This file closes the gap named in the audit: queue.test.ts's flush()
 * coverage only ever fed postOne() hand-typed Response bodies (fabricated
 * redirect locations, fabricated statuses). Here the fetch() queue.ts calls
 * is instead answered by actually invoking the REAL `+page.server.ts`
 * action against the real in-process DB, using the exact request body/
 * headers postOne() sent — so the redirect location, status codes, and
 * idempotency behaviour under test all come from production code, not from
 * a mock we hand-rolled to match our own assumptions.
 *
 * The one piece we can't reproduce without a real Vite-served request is
 * that SvelteKit's real JSON envelope ships `data` devalue-encoded rather
 * than as a plain object — irrelevant here since postOne() never reads
 * `.data`, only `type` / `status` / `location` / `error.status`.
 */
type FlowOutcome =
  | { kind: 'redirect'; status: number; location: string }
  | { kind: 'error'; status: number; message: string }
  | { kind: 'return'; value: unknown };

function toEnvelopeResponse(outcome: FlowOutcome): Response {
  let body: unknown;
  if (outcome.kind === 'redirect') {
    body = { type: 'redirect', status: outcome.status, location: outcome.location };
  } else if (outcome.kind === 'error') {
    body = { type: 'error', error: { message: outcome.message, status: outcome.status } };
  } else {
    const value = outcome.value as { status?: number; data?: unknown } | undefined;
    if (typeof value?.status !== 'number') {
      throw new Error(`unexpected action return shape: ${JSON.stringify(value)}`);
    }
    body = { type: 'failure', status: value.status, data: value.data };
  }
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

function formDataFromBody(body: URLSearchParams): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(body.keys())) {
    const values = body.getAll(key);
    out[key] = values.length > 1 ? values : values[0];
  }
  return out;
}

async function setup() {
  const u = await seedUser();
  const c = await seedChild({ createdBy: u.id });
  const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
  const food = (
    await testDb
      .insert(foods)
      .values({
        name: 'Carotte',
        category: 'legumes',
        isMajorAllergen: false,
        allergenType: null,
        suggestedAgeMonths: 4,
        notes: null,
        isCustom: false,
        customForChildId: null
      })
      .returning()
  )[0];
  return { u, c, m, food };
}

/**
 * Builds a fetch-shaped responder that actually runs the real
 * `/child/[id]/log` action against real formData/headers decoded from what
 * postOne() posted — a stand-in for the real HTTP server, without booting
 * Vite. Returned as a plain function (not a spy) so tests can compose it —
 * e.g. wrap it to simulate a dropped response — before installing it.
 */
function realActionResponder(
  user: Awaited<ReturnType<typeof setup>>['u'],
  membership: Awaited<ReturnType<typeof setup>>['m'],
  childId: number
) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const match = String(input).match(/^\/child\/(\d+)\/log$/);
    if (!match) throw new Error(`unexpected fetch url: ${String(input)}`);
    const headers = init!.headers as Record<string, string>;
    const formData = formDataFromBody(init!.body as URLSearchParams);
    const outcome = (await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          user: safeUser(user),
          memberships: [membership],
          params: { id: String(childId) },
          formData,
          headers: { 'Idempotency-Key': headers['Idempotency-Key'] }
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    )) as FlowOutcome;
    return toEnvelopeResponse(outcome);
  };
}

describe('offline queue replay against a real server response', () => {
  beforeEach(async () => {
    await resetTestDb();
    await clear();
    mock.restore();
  });

  it('flush() drains a queued entry through the real action: DB write, IDB clear, real redirect parsed', async () => {
    const { u, c, m, food } = await setup();
    spyOn(globalThis, 'fetch').mockImplementation(realActionResponder(u, m, c.id));

    const synced: unknown[] = [];
    const handler = (e: Event) => synced.push((e as CustomEvent).detail);
    window.addEventListener('queue:synced', handler);

    await enqueue({
      key: 'replay-real-1',
      childId: c.id,
      formData: { foodId: String(food.id), givenAt: '2026-05-07T10:00:00.000Z', reaction: 'ras' },
      queuedAt: 1
    });

    await flush();

    expect(await count()).toBe(0);
    expect(synced).toEqual([{ childId: c.id, qs: expect.stringContaining('logged=1') }]);

    const rows = await testDb.select().from(foodEntries).where(eq(foodEntries.childId, c.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].foodId).toBe(food.id);

    window.removeEventListener('queue:synced', handler);
  });

  it('flush() drops a queued entry the real action rejects (real fail(), not a fabricated 400)', async () => {
    const { u, c, m } = await setup();
    spyOn(globalThis, 'fetch').mockImplementation(realActionResponder(u, m, c.id));

    const dropped: unknown[] = [];
    const handler = (e: Event) => dropped.push((e as CustomEvent).detail);
    window.addEventListener('queue:dropped', handler);

    await enqueue({
      key: 'replay-invalid-date',
      childId: c.id,
      formData: { givenAt: 'not-a-date', reaction: 'ras' }, // no foodId → real .refine() failure
      queuedAt: 1
    });

    await flush();

    expect(await count()).toBe(0);
    expect(dropped).toEqual([{ reason: 'failure', status: 400 }]);
    window.removeEventListener('queue:dropped', handler);

    const n =
      (
        await testDb
          .select({ n: sql<number>`count(*)` })
          .from(foodEntries)
          .limit(1)
      )[0]?.n ?? 0;
    expect(Number(n)).toBe(0);
  });

  it('replaying after a dropped response does not duplicate the food entry (real server-side idempotency)', async () => {
    const { u, c, m, food } = await setup();
    const respond = realActionResponder(u, m, c.id);
    let calls = 0;

    // The FIRST call runs the real action (which really inserts, since
    // bun:sqlite transactions commit synchronously) but then simulates the
    // client never seeing the response — exactly what "replay on reconnect"
    // means: the row stays queued and is POSTed again on the next flush.
    spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      calls += 1;
      const response = await respond(input, init);
      if (calls === 1) throw new TypeError('Failed to fetch');
      return response;
    });

    await enqueue({
      key: 'reconnect-1',
      childId: c.id,
      formData: { foodId: String(food.id), givenAt: '2026-05-07T10:00:00.000Z', reaction: 'ras' },
      queuedAt: 1
    });

    await flush(); // network drop after the real server-side insert already committed
    expect(await count()).toBe(1);

    await flush(); // reconnect: same row, same Idempotency-Key, real cached redirect
    expect(await count()).toBe(0);

    const n =
      (
        await testDb
          .select({ n: sql<number>`count(*)` })
          .from(foodEntries)
          .limit(1)
      )[0]?.n ?? 0;
    expect(Number(n)).toBe(1);
  });
});
