import { describe, it, expect, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('$lib/server/db', () => ({ db: { get } }));

import { GET } from './+server';

describe('GET /healthz', () => {
  it('returns 200 with ok payload when the DB probe succeeds', async () => {
    get.mockReturnValueOnce({ ok: 1 });
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBe('ok');
    expect(typeof body.uptimeMs).toBe('number');
    expect(body.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns 503 with down payload when the DB probe throws', async () => {
    get.mockImplementationOnce(() => {
      throw new Error('SQLITE_CORRUPT');
    });
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.db).toBe('down');
  });
});
