import { stringify } from 'devalue';
import { fieldsOf, type Transport } from '#lib/offline/wire.js';
import type { SafeUser } from '#lib/types.js';
import { actions } from '../routes/child/[id]/log/+page.server';
import { seedFood } from './repas';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser,
  type RouteEventOptions
} from './route';

/** Who the in-process server sees as signed in, read on every request. */
export type Identity = { user: SafeUser | null; memberships: RouteEventOptions['memberships'] };

type FlowOutcome = Awaited<ReturnType<typeof captureFlow>>;

/**
 * The test adapter for the durable submit's transport port: instead of the
 * network, it runs the REAL `/child/[id]/log` action against the in-process
 * database and answers with the envelope SvelteKit 3's
 * `handle_action_json_request` builds for it (`devalue`-encoded data, the
 * action `location`, statuses where the real server puts them). The redirect
 * location, statuses and idempotency behaviour under test all come from
 * production code.
 *
 * `identity` is read per request, so a test can expire the session or revoke
 * a membership between two replays.
 */
export function inProcessTransport(identity: () => Identity): Transport {
  return async (url, init) => {
    const request = new Request(new URL(url, 'http://localhost'), init);
    const requestUrl = new URL(request.url);
    const match = requestUrl.pathname.match(/^\/(?:en\/)?child\/(\d+)\/log$/);
    if (!match) throw new Error(`unexpected url: ${request.url}`);
    const formData = fieldsOf(await request.formData());
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
    return envelope(outcome, actionLocation(requestUrl));
  };
}

/** A signed-in owner of a child born 2024-01-01, two catalog aliments, and the server for them. */
export async function seedLogScene() {
  const user = await seedUser();
  const child = await seedChild({ createdBy: user.id });
  const membership = await seedMembership({ userId: user.id, childId: child.id, role: 'owner' });
  const carotte = await seedFood({ name: 'Carotte' });
  const pomme = await seedFood({ name: 'Pomme', category: 'fruits' });
  const signedIn: Identity = { user: safeUser(user), memberships: [membership] };
  return { user, child, membership, carotte, pomme, transport: inProcessTransport(() => signedIn) };
}

// SvelteKit's get_action_location: the URL without its `?/action` key.
function actionLocation(url: URL): string {
  const location = new URL(url);
  const actionKey = [...location.searchParams.keys()].find((key) => key.startsWith('/'));
  if (actionKey) location.searchParams.delete(actionKey);
  return location.pathname + location.search;
}

function envelope(outcome: FlowOutcome, location: string): Response {
  if (outcome.kind === 'redirect') {
    // A redirect's status travels in the body only; the response is a 200.
    return json(200, { type: 'redirect', status: outcome.status, location: outcome.location });
  }
  if (outcome.kind === 'error') {
    // error(): the status rides on the HTTP response only, and the body is
    // the error's own (hooks.server.ts's handleError leaves 'app' errors be).
    return json(outcome.status, { type: 'error', location, error: { message: outcome.message } });
  }
  const value = outcome.value as { status?: number; data?: unknown } | undefined;
  if (typeof value?.status !== 'number') {
    throw new Error(`unexpected action return shape: ${JSON.stringify(value)}`);
  }
  // fail(): the status goes on both the body and the response.
  return json(value.status, {
    type: 'failure',
    status: value.status,
    location,
    data: stringify(value.data)
  });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}
