import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import 'fake-indexeddb/auto';

import { purgeBeforeSubmit, purgeClientState } from './purge';
import { clear, enqueue } from './queue';

type CachesLike = { delete: (name: string) => Promise<boolean> };

const globalWithCaches = globalThis as typeof globalThis & { caches?: CachesLike };
const ORIG_CACHES = globalWithCaches.caches;

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

beforeEach(async () => {
  await clear();
});

afterEach(async () => {
  await clear();
  if (ORIG_CACHES === undefined) delete globalWithCaches.caches;
  else globalWithCaches.caches = ORIG_CACHES;
});

describe('purgeClientState', () => {
  it('deletes the pages cache and leaves assets alone', async () => {
    const deleted: string[] = [];
    globalWithCaches.caches = {
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      }
    };
    await purgeClientState();
    expect(deleted).toEqual(['pages']);
  });

  it('clears the offline queue', async () => {
    delete globalWithCaches.caches;
    await enqueue({ key: 'k1', childId: 1, formData: { foodId: '2' }, queuedAt: Date.now() });
    expect(await countRows()).toBe(1);
    await purgeClientState();
    expect(await countRows()).toBe(0);
  });

  it('still clears the queue when CacheStorage deletion throws', async () => {
    globalWithCaches.caches = {
      delete: async () => {
        throw new Error('cache storage unavailable');
      }
    };
    await enqueue({ key: 'k1', childId: 1, formData: { foodId: '2' }, queuedAt: Date.now() });
    await expect(purgeClientState()).resolves.toBeUndefined();
    expect(await countRows()).toBe(0);
  });

  it('swallows IndexedDB failures instead of breaking navigation', async () => {
    delete globalWithCaches.caches;
    const globalWithIdb = globalThis as typeof globalThis & { indexedDB: IDBFactory };
    const origIdb = globalWithIdb.indexedDB;
    globalWithIdb.indexedDB = {
      ...origIdb,
      open: () => {
        throw new Error('idb unavailable');
      }
    } as IDBFactory;
    try {
      await expect(purgeClientState()).resolves.toBeUndefined();
    } finally {
      globalWithIdb.indexedDB = origIdb;
    }
  });

  it('is a no-op for caches when CacheStorage is undefined (non-secure context)', async () => {
    delete globalWithCaches.caches;
    await expect(purgeClientState()).resolves.toBeUndefined();
  });
});

describe('purgeBeforeSubmit', () => {
  function makeSubmitEvent() {
    let submitted = false;
    const form = {
      submit: () => {
        submitted = true;
      }
    };
    let prevented = false;
    const event = {
      currentTarget: form,
      preventDefault: () => {
        prevented = true;
      }
    } as unknown as SubmitEvent;
    return { event, wasPrevented: () => prevented, wasSubmitted: () => submitted };
  }

  it('purges client state BEFORE re-submitting the form natively', async () => {
    const deleted: string[] = [];
    let deletedBeforeSubmit = false;
    const { event, wasPrevented, wasSubmitted } = makeSubmitEvent();
    globalWithCaches.caches = {
      delete: async (name: string) => {
        deleted.push(name);
        return true;
      }
    };
    // Re-wrap form.submit to observe ordering: the purge must complete first.
    const form = event.currentTarget as unknown as { submit: () => void };
    const origSubmit = form.submit;
    form.submit = () => {
      deletedBeforeSubmit = deleted.includes('pages');
      origSubmit();
    };

    purgeBeforeSubmit(event);
    expect(wasPrevented()).toBe(true);

    // The handler is sync; the purge + submit run on the microtask queue.
    await new Promise((r) => setTimeout(r, 0));
    expect(wasSubmitted()).toBe(true);
    expect(deletedBeforeSubmit).toBe(true);
  });

  it('still submits when the purge machinery is unavailable', async () => {
    delete globalWithCaches.caches;
    const { event, wasSubmitted } = makeSubmitEvent();
    purgeBeforeSubmit(event);
    await new Promise((r) => setTimeout(r, 0));
    expect(wasSubmitted()).toBe(true);
  });
});
