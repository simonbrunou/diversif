// The offline queue's IndexedDB, opened the way src/lib/offline/queue.ts
// opens it, for tests that read or write rows behind the module's back:
// the stored row format is a contract between client versions.

function openQueueDb(): Promise<IDBDatabase> {
  const req = indexedDB.open('diversif-offline', 1);
  return new Promise((resolve, reject) => {
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore('log', { keyPath: 'key' });
      store.createIndex('queuedAt', 'queuedAt', { unique: false });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Every stored row, as IndexedDB holds it. */
export async function rawRows(): Promise<unknown[]> {
  const db = await openQueueDb();
  const rows = await new Promise<unknown[]>((resolve, reject) => {
    const req = db.transaction('log', 'readonly').objectStore('log').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows;
}

/** Write a row straight into IndexedDB, the way an older client left it. */
export async function putRawRow(row: unknown): Promise<void> {
  const db = await openQueueDb();
  await new Promise<void>((resolve, reject) => {
    const t = db.transaction('log', 'readwrite');
    t.objectStore('log').put(row);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
  db.close();
}
