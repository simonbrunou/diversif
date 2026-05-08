import { describe, it, expect, vi } from 'vitest';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('$lib/server/db', () => ({ db: { execute } }));

import { GET } from './+server';

describe('GET /healthz', () => {
  it('returns 200 with ok payload when the DB probe succeeds', async () => {
    execute.mockResolvedValueOnce({ rows: [{ ok: 1 }] });
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
    execute.mockRejectedValueOnce(new Error('connection refused'));
    const res = await GET({} as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.db).toBe('down');
  });
});
