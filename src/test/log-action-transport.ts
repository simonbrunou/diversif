import { stringify } from 'devalue';
import type { Transport } from '#lib/offline/wire.js';
import type { SafeUser } from '#lib/types.js';
import { actions } from '../routes/child/[id]/log/+page.server';
import { captureFlow, makeRouteEvent, type RouteEventOptions } from './route';

/** Who the in-process server sees as signed in, read on every request. */
export type Identity = { user: SafeUser | null; memberships: RouteEventOptions['memberships'] };

type FlowOutcome = Awaited<ReturnType<typeof captureFlow>>;

/**
 * The test adapter for the durable submit's transport port: instead of the
 * network, it runs the REAL `/child/[id]/log` action against the in-process
 * database and answers with the envelope SvelteKit 3's
 * `handle_action_json_request` would send. The redirect location, statuses
 * and idempotency behaviour under test all come from production code.
 *
 * `identity` is read per request, so a test can expire the session or revoke
 * a membership between two replays.
 */
export function inProcessTransport(identity: () => Identity): Transport {
  return async (url, init) => {
    const request = new Request(new URL(url, 'http://localhost'), init);
    const match = new URL(request.url).pathname.match(/^\/(?:en\/)?child\/(\d+)\/log$/);
    if (!match) throw new Error(`unexpected url: ${request.url}`);
    const formData: Record<string, string | string[]> = {};
    const sent = await request.formData();
    for (const key of new Set(sent.keys())) {
      const values = sent.getAll(key).map(String);
      formData[key] = values.length > 1 ? values : values[0];
    }
    const outcome = await captureFlow(() =>
      actions.default!(
        makeRouteEvent({
          ...identity(),
          url: request.url,
          params: { id: match[1] },
          formData
        }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
      )
    );
    return envelope(outcome);
  };
}

function envelope(outcome: FlowOutcome): Response {
  if (outcome.kind === 'redirect') {
    // A redirect's status travels in the body only; the response is a 200.
    return json(200, { type: 'redirect', status: outcome.status, location: outcome.location });
  }
  if (outcome.kind === 'error') {
    // The status rides on the HTTP response only, and hooks.server.ts's
    // handleError reduces the body to a generic message + errorId.
    return json(outcome.status, {
      type: 'error',
      error: { message: 'Internal Error', errorId: 'deadbeef' }
    });
  }
  const value = outcome.value as { status?: number; data?: unknown } | undefined;
  if (typeof value?.status !== 'number') {
    throw new Error(`unexpected action return shape: ${JSON.stringify(value)}`);
  }
  // fail(): the status goes on both the body and the response, and `data`
  // is devalue-encoded, as SvelteKit's own server serializes it.
  return json(value.status, { type: 'failure', status: value.status, data: stringify(value.data) });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
