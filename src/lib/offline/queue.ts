import { writable, type Readable } from 'svelte/store';

export interface QueuedSubmit {
  key: string;
  childId: number;
  formData: Record<string, string>;
  queuedAt: number;
}

const DB_NAME = 'diversif-offline';
const STORE = 'log';

const _pendingCount = writable(0);
export const pendingCount: Readable<number> = { subscribe: _pendingCount.subscribe };

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

async function refreshCount(): Promise<void> {
  const n = await tx('readonly', async (store) => reqAsPromise(store.count()));
  _pendingCount.set(n);
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
  await refreshCount();
}

export async function enqueue(item: QueuedSubmit): Promise<void> {
  await tx('readwrite', async (store) => {
    await reqAsPromise(store.put(item));
  });
  await refreshCount();
}

export async function clear(): Promise<void> {
  await tx('readwrite', async (store) => {
    await reqAsPromise(store.clear());
  });
  await refreshCount();
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
  error: { message: string; status?: number };
}
type ActionResult = ActionRedirect | ActionFailure | ActionError;

function emit(name: string, detail?: unknown): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

async function postOne(row: QueuedSubmit): Promise<'ok' | 'drop' | 'retry'> {
  const body = new URLSearchParams(row.formData);
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
    if (result.location === '/login' || result.location.startsWith('/login?')) {
      emit('queue:sessionExpired');
      return 'drop';
    }
    const m = result.location.match(/^\/child\/(\d+)\?(.+)$/);
    if (m) {
      emit('queue:synced', { childId: Number(m[1]), qs: m[2] });
    }
    return 'ok';
  }
  if (result.type === 'error') {
    const status = result.error.status ?? 500;
    if (status >= 500) return 'retry';
    emit('queue:dropped', { reason: 'error', status });
    return 'drop';
  }
  // type === 'failure'
  if (result.status === 409 || result.status === 429) return 'retry';
  emit('queue:dropped', { reason: 'failure', status: result.status });
  return 'drop';
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
        }
        if (outcome === 'retry') {
          // Stop processing; subsequent rows will be tried on the next flush.
          break;
        }
      }
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

// Module init: hydrate the count from IDB so the badge is accurate after
// a fresh page load with pre-existing rows.
if (typeof indexedDB !== 'undefined') {
  /* v8 ignore next */
  void refreshCount().catch(() => {
    // IDB unavailable or fresh; ignore.
  });
}
