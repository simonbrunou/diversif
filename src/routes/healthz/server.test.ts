import { describe, expect, it, mock } from 'bun:test';
// bun:sqlite is synchronous: the healthz probe calls db.get() (not .execute())
// and relies on it throwing when the handle is dead.
const { get } = { get: mock() };
mock.module('$lib/server/db', () => ({ db: { get } }));

import { GET } from './+server';

describe('GET /healthz', () => {
  it('returns 200 with ok payload when the DB probe succeeds', async () => {
    get.mockReturnValueOnce({ ok: 1 });
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe('ok');
    expect(typeof body.uptimeMs).toBe('number');
    expect(body.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns 503 with down payload when the DB probe throws', async () => {
    get.mockImplementationOnce(() => {
      throw new Error('database is closed');
    });
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.db).toBe('down');
  });
});
