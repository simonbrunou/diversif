export interface QueuedSubmit {
  key: string;
  childId: number;
  formData: Record<string, string | string[]>;
  queuedAt: number;
  // Set when a replay redirected to /login: the row is retained (not
  // deleted) instead of being lost with the rest of the session, surfaced
  // via a persistent "log back in to sync" affordance, and only cleared
  // once a subsequent replay actually succeeds — see #308.
  status?: 'needs-reauth';
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

interface ActionRedirect {
  type: 'redirect';
  location: string;
}
interface ActionFailure {
  type: 'failure';
  status: number;
  data?: Record<string, unknown>;
}
interface ActionError {
  type: 'error';
  // SvelteKit's `handle_action_json_request` puts the real numeric status
  // only on the HTTP Response (get_status(err)); the JSON body's `error`
  // object never carries a `status` field — this app's own
  // src/hooks.server.ts:handleError explicitly strips it, returning only
  // `{ message: 'Internal Error', errorId }` for every status < 500. Reading
  // `error.status` here would always be `undefined`.
  error: { message: string };
}
type ActionResult = ActionRedirect | ActionFailure | ActionError;

function emit(name: string, detail?: unknown): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

export function buildBody(form: Record<string, string | string[]>): URLSearchParams {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(form)) {
    if (Array.isArray(v)) for (const item of v) body.append(k, item);
    else body.append(k, v);
  }
  return body;
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

async function postOne(row: QueuedSubmit): Promise<'ok' | 'drop' | 'retry' | 'needs-reauth'> {
  const body = buildBody(row.formData);
  let res: Response;
  try {
    res = await fetch(`/child/${row.childId}/log`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-sveltekit-action': 'true',
        'Idempotency-Key': row.key
      },
      body
    });
  } catch {
    return 'retry';
  }

  let result: ActionResult;
  try {
    result = (await res.clone().json()) as ActionResult;
  } catch {
    return 'retry';
  }

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
    const m = result.location.match(/^\/(?:[a-z]{2}\/)?child\/(\d+)\?(.+)$/);
    if (m) {
      emit('queue:synced', { childId: Number(m[1]), qs: m[2] });
    }
    return 'ok';
  }
  if (result.type === 'error') {
    // The real status lives on the HTTP response, not the JSON body — see
    // the ActionError interface comment above. Mirror what SvelteKit's own
    // client deserialize() does for the redirect/success paths: read it off
    // `res`, never off the (always status-less) body.
    if (res.status >= 500) return 'retry';
    return dropRow(res.status, 'error');
  }
  // type === 'failure'
  if (result.status === 409 || result.status === 429) return 'retry';
  return dropRow(result.status, 'failure');
}

export function flush(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const rows = await readAllOrdered();
      for (const row of rows) {
        const outcome = await postOne(row);
        if (outcome === 'ok' || outcome === 'drop') {
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
    }
  })();
  return inFlight;
}
