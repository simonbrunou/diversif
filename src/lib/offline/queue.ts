import { fetchTransport, postAction, type Fields, type Transport } from './wire';

export interface QueuedSubmit {
  key: string;
  childId: number;
  formData: Fields;
  queuedAt: number;
  // Set when a replay redirected to /login: the row is retained (not
  // deleted) instead of being lost with the rest of the session, surfaced
  // via a persistent "log back in to sync" affordance, and only cleared
  // once a subsequent replay actually succeeds — see #308.
  status?: 'needs-reauth';
}

// Detail of the queue:synced event flush() dispatches on window: one replay
// redirect query string per repas the pass sent and removed from the queue.
export interface QueueSyncedDetail {
  queryStrings: string[];
}

const DB_NAME = 'diversif-offline';
const STORE = 'log';

let inFlight: Promise<void> | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => Promise<T>
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    let result: T;
    let pending: Promise<T> | null = fn(store);
    pending.then(
      (r) => {
        result = r;
      },
      (err) => {
        try {
          transaction.abort();
        } catch {
          // already aborted
        }
        reject(err);
        pending = null;
      }
    );
    transaction.oncomplete = () => {
      if (pending !== null) resolve(result);
    };
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('IDB transaction aborted'));
  });
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readAllOrdered(): Promise<QueuedSubmit[]> {
  return tx('readonly', async (store) => {
    const idx = store.index('queuedAt');
    const all = await reqAsPromise(idx.getAll());
    return all as QueuedSubmit[];
  });
}

async function deleteRow(key: string): Promise<void> {
  await tx('readwrite', async (store) => {
    await reqAsPromise(store.delete(key));
  });
  emit('queue:changed');
}

async function markNeedsReauth(row: QueuedSubmit): Promise<void> {
  await tx('readwrite', async (store) => {
    await reqAsPromise(store.put({ ...row, status: 'needs-reauth' }));
  });
  emit('queue:changed');
  emit('queue:needsReauth', { key: row.key });
}

export async function enqueue(item: QueuedSubmit): Promise<void> {
  await tx('readwrite', async (store) => {
    await reqAsPromise(store.put(item));
  });
  emit('queue:changed');
}

export async function clear(): Promise<void> {
  await tx('readwrite', async (store) => {
    await reqAsPromise(store.clear());
  });
  emit('queue:changed');
}

/** Number of rows still queued — feeds the persistent "N pending" indicator. */
export async function count(): Promise<number> {
  return tx('readonly', async (store) => reqAsPromise(store.count()));
}

/**
 * Rows retained pending re-authentication — feeds the "log back in to sync"
 * persistent affordance. A subset of count(), which stays meaningful (never
 * silently drops to zero) because these rows are never deleted; only a
 * subsequent successful replay clears them.
 */
export async function needsReauthCount(): Promise<number> {
  const rows = await readAllOrdered();
  return rows.filter((r) => r.status === 'needs-reauth').length;
}

function emit(name: string, detail?: unknown): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

// 401/403/404 mean the requireChildContext guard rejected a replay because
// the child was deleted or this user's access was revoked while the entry
// sat in the queue — not a transient or malformed-request failure. Surface
// that distinctly (queue:accessRevoked) so the parent understands the
// entry is gone because the carnet is gone, not because of an unexplained
// bug; every other non-retriable status keeps the generic queue:dropped.
function dropRow(status: number, reason: 'error' | 'failure'): 'drop' {
  if (status === 401 || status === 403 || status === 404) {
    emit('queue:accessRevoked', { status });
  } else {
    emit('queue:dropped', { reason, status });
  }
  return 'drop';
}

// A successful replay resolves to its redirect's query string: the repas's
// milestone flags (see milestonesPath in #lib/utils/milestones), '' if it
// has none.
async function postOne(
  row: QueuedSubmit,
  transport: Transport
): Promise<{ qs: string } | 'drop' | 'retry' | 'needs-reauth'> {
  // The key travels as a form field, as with the online submit. Rows queued
  // before #325 don't carry the field, so it is always copied from the row.
  const result = await postAction(transport, `/child/${row.childId}/log`, {
    ...row.formData,
    idempotencyKey: row.key
  });
  if (result === 'unreachable') return 'retry';

  if (result.type === 'redirect') {
    // Match every locale-prefixed login redirect (paraglide rewrites bare
    // /login to /en/login for English-locale users). Bare /login covers FR
    // since FR is the unprefixed default. The session expired before this
    // row could replay — the action never ran, so the row must be kept
    // (never deleted) until a later replay actually succeeds; flush()
    // handles retaining + surfacing it.
    if (/^\/(?:[a-z]{2}\/)?login(?:\?|$)/.test(result.location)) {
      return 'needs-reauth';
    }
    return { qs: result.location.split('?')[1] ?? '' };
  }
  if (result.type === 'error') {
    // postAction read the status off the HTTP response (wire.ts).
    const status = result.status ?? 500;
    if (status >= 500) return 'retry';
    return dropRow(status, 'error');
  }
  // type === 'failure' (the log action never answers 'success')
  if (result.status === 409 || result.status === 429) return 'retry';
  return dropRow(result.status, 'failure');
}

export function flush(transport: Transport = fetchTransport): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const synced: string[] = [];
    try {
      const rows = await readAllOrdered();
      for (const row of rows) {
        const outcome = await postOne(row, transport);
        if (typeof outcome === 'object') {
          await deleteRow(row.key);
          synced.push(outcome.qs);
        } else if (outcome === 'drop') {
          await deleteRow(row.key);
        } else if (outcome === 'needs-reauth') {
          // Retained, not deleted (see the QueuedSubmit.status comment).
          // Only write + emit on the actual transition, so re-attempting
          // an already-marked row on every subsequent flush poll doesn't
          // spam queue:changed while the user is still logged out. Continue
          // to the next row instead of `break`ing like 'retry' below: every
          // other queued row shares the same expired session and deserves
          // its own chance to be marked/surfaced in this same pass, not be
          // wedged behind this one until it happens to succeed first.
          if (row.status !== 'needs-reauth') {
            await markNeedsReauth(row);
          }
        } else {
          // 'retry': a transient/systemic failure (network drop, 5xx,
          // 409/429) — stop processing; subsequent rows will be tried on
          // the next flush.
          break;
        }
      }
    } finally {
      inFlight = null;
      // Announced once per pass, and only for rows already deleted: a row
      // replayed again after a failed delete or a closed tab returns its
      // cached redirect, which would celebrate the same repas twice.
      if (synced.length > 0) {
        emit('queue:synced', { queryStrings: synced } satisfies QueueSyncedDetail);
      }
    }
  })();
  return inFlight;
}
