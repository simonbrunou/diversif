import type { ActionResult } from '$app/forms';
import { localInputToIso } from '#lib/utils/dates.js';
import { enqueue, type QueuedSubmit } from './queue';
import { fetchTransport, fieldsOf, postAction, type Transport } from './wire';

// The durable submit: how the log and edit forms send a repas. It turns the
// datetime-local meal date into an instant, sends the form to its action and,
// for the log form, falls back to the offline queue (queue.ts) when the
// server can't be reached. RepasForm.svelte applies the outcome to the page.

export type Submitted =
  /** The server answered; apply `result` to the page. */
  | { kind: 'sent'; result: ActionResult }
  /** Stored in IndexedDB; the queue replays it once the server is reachable. */
  | { kind: 'queued' }
  /** Neither sent nor queued: nothing was saved. */
  | { kind: 'failed' };

export type SubmitTarget = {
  /** The URL the form posts to (its resolved `action`). */
  action: string;
  /**
   * The child whose log action replays the repas. Set it on the log form
   * only: it makes the submit durable. Edits are never queued.
   */
  queueFor?: number;
};

export async function submitRepas(
  form: FormData,
  target: SubmitTarget,
  transport: Transport = fetchTransport
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
    navigator.onLine === false ? 'unreachable' : await postAction(transport, target.action, fields);
  if (answer !== 'unreachable') return { kind: 'sent', result: answer };
  if (!durable) return { kind: 'failed' };
  return enqueueOrFail({
    key: durable.key,
    childId: durable.childId,
    formData: fields,
    queuedAt: Date.now()
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
