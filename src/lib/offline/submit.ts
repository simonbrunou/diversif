import type { ActionResult } from '$app/forms';
import { localInputToIso } from '#lib/utils/dates.js';
import { enqueue, type QueuedSubmit } from './queue';
import {
  fetchTransport,
  fieldsOf,
  postAction,
  UNREACHABLE,
  withDeadline,
  type Answer,
  type Fields,
  type Transport
} from './wire';

// The durable submit: how the log and edit forms send a repas. It turns the
// datetime-local meal date into an instant, sends the form to its action and,
// for the log form, falls back to the offline queue (queue.ts) when no answer
// came from the action: the server can't be reached, a hook failed first, or
// the deadline passed. RepasForm.svelte applies the outcome to the page.

// How long an online submit may take, its answer's body included, before it is
// cancelled. A repas action answers in well under a second. 30 s leaves room
// for a slow mobile handshake and upload, the value the queue's replay takes
// for the same reason (REPLAY_DEADLINE_MS in queue.ts). Without it a stalled
// request (a half-open mobile connection, a proxy that never answers) kept the
// form busy until the browser gave up on it (#577).
const SUBMIT_DEADLINE_MS = 30_000;

export type Submitted =
  /** The server answered; apply `result` to the page. */
  | { kind: 'sent'; result: ActionResult }
  /** Stored in IndexedDB; the queue replays it once the server is reachable. */
  | { kind: 'queued' }
  /** Neither sent nor queued: nothing was saved. */
  | { kind: 'failed' }
  /**
   * An edit got no answer before the deadline: the server may still have
   * saved it. Sending it again writes the same values.
   */
  | { kind: 'timedOut' };

export type SubmitTarget = {
  /** The URL the form posts to (its resolved `action`). */
  action: string;
  /**
   * The child whose log action replays the repas. Set it on the log form
   * only: it makes the submit durable. Edits are never queued.
   */
  queueFor?: number;
  /**
   * The signed-in user's id, stored on a queued row with `queueFor`: the
   * replay drops a row queued by another user than the session's (#566).
   * The online attempt does not send it.
   */
  queuedBy?: number;
};

export async function submitRepas(
  form: FormData,
  target: SubmitTarget,
  transport: Transport = fetchTransport,
  deadlineMs = SUBMIT_DEADLINE_MS
): Promise<Submitted> {
  const fields = fieldsOf(form);
  if (typeof fields.givenAt === 'string') fields.givenAt = localInputToIso(fields.givenAt);

  // One key per durable submit, sent with the online attempt and kept as the
  // queued row's key: a request that reached the server before the client
  // saw it fail can't log the repas twice when its queued copy replays.
  const durable =
    target.queueFor === undefined ? null : { childId: target.queueFor, key: crypto.randomUUID() };
  if (durable) fields.idempotencyKey = durable.key;

  const answer =
    navigator.onLine === false
      ? UNREACHABLE
      : await send(transport, target.action, fields, deadlineMs);
  if (answer.kind === 'action') return { kind: 'sent', result: answer.result };
  if (!durable) {
    // Never queued: a hook's error goes to the page as use:enhance applied
    // it, a request the deadline cut short may have been saved, and no
    // answer at all fails.
    if (answer.kind === 'hook') return { kind: 'sent', result: answer.result };
    return answer.kind === 'timedOut' ? { kind: 'timedOut' } : { kind: 'failed' };
  }
  // The log form queues all three: the hook may work on replay, and the key
  // keeps a request the server did save from logging the repas twice.
  return enqueueOrFail({
    key: durable.key,
    childId: durable.childId,
    formData: fields,
    queuedAt: Date.now(),
    ...(target.queuedBy === undefined ? {} : { queuedBy: target.queuedBy })
  });
}

// postAction under the deadline. It answers `unreachable` both for a request
// that failed and for one the deadline aborted; only the signal tells them
// apart.
function send(
  transport: Transport,
  url: string,
  fields: Fields,
  deadlineMs: number
): Promise<Answer | { kind: 'timedOut' }> {
  return withDeadline(deadlineMs, async (signal) => {
    const answer = await postAction(transport, url, fields, signal);
    return answer.kind === 'unreachable' && signal.aborted ? { kind: 'timedOut' } : answer;
  });
}

async function enqueueOrFail(row: QueuedSubmit): Promise<Submitted> {
  try {
    await enqueue(row);
    return { kind: 'queued' };
  } catch {
    return { kind: 'failed' };
  }
}
