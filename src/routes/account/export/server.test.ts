import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

const exportSpy = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock('$lib/server/gdpr', async () => {
  const actual = await vi.importActual<typeof import('$lib/server/gdpr')>('$lib/server/gdpr');
  return {
    ...actual,
    exportUserData: (...args: Parameters<typeof actual.exportUserData>) => exportSpy.fn(...args)
  };
});

import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { ExportTooLargeError } from '$lib/server/gdpr';
import { GET } from './+server';

let realExport: (userId: number) => unknown;
beforeAll(async () => {
  const actual = await vi.importActual<typeof import('$lib/server/gdpr')>('$lib/server/gdpr');
  realExport = actual.exportUserData;
});

beforeEach(() => {
  resetTestDb();
  // Default the spy to the real implementation; individual tests can
  // override it to simulate the oversize path without seeding 50k rows.
  exportSpy.fn.mockImplementation((userId: number) => realExport(userId));
});

async function seedUser() {
  return testDb
    .insert(users)
    .values({
      email: 'exp@example.com',
      passwordHash: 'h',
      displayName: 'E',
      createdAt: new Date()
    })
    .returning()
    .all()[0];
}

describe('account export GET', () => {
  it('redirects unauthenticated users to /login', async () => {
    const event = makeRouteEvent({ user: null });
    const r = await captureFlow(() => GET(event as unknown as Parameters<typeof GET>[0]));
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('returns a JSON attachment for the authenticated user', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({ user: safeUser(u) });
    const response = (await GET(event as unknown as Parameters<typeof GET>[0])) as Response;
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('content-disposition')).toContain('attachment');
    const json = JSON.parse(await response.text());
    expect(json.profile.email).toBe('exp@example.com');

    const fresh = testDb.select().from(users).where(eq(users.id, u.id)).get();
    expect(fresh?.lastExportAt).toBeInstanceOf(Date);
  });

  it('throttles a second request within one minute', async () => {
    const u = await seedUser();
    testDb
      .update(users)
      .set({ lastExportAt: new Date(Date.now() - 5_000) })
      .where(eq(users.id, u.id))
      .run();
    const event = makeRouteEvent({ user: safeUser(u) });
    const r = await captureFlow(() => GET(event as unknown as Parameters<typeof GET>[0]));
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(429);
  });

  it('allows a new export after the throttle window has passed', async () => {
    const u = await seedUser();
    testDb
      .update(users)
      .set({ lastExportAt: new Date(Date.now() - 120_000) })
      .where(eq(users.id, u.id))
      .run();
    const event = makeRouteEvent({ user: safeUser(u) });
    const response = (await GET(event as unknown as Parameters<typeof GET>[0])) as Response;
    expect(response.status).toBe(200);
  });

  it('rejects a back-to-back second call (no pre-seeding required)', async () => {
    const u = await seedUser();
    const event1 = makeRouteEvent({ user: safeUser(u) });
    const r1 = (await GET(event1 as unknown as Parameters<typeof GET>[0])) as Response;
    expect(r1.status).toBe(200);

    const event2 = makeRouteEvent({ user: safeUser(u) });
    const r2 = await captureFlow(() => GET(event2 as unknown as Parameters<typeof GET>[0]));
    expect(r2.kind).toBe('error');
    if (r2.kind === 'error') expect(r2.status).toBe(429);
  });

  it('returns 413 with an actionable message when the export is too large', async () => {
    const u = await seedUser();
    exportSpy.fn.mockImplementation(() => {
      throw new ExportTooLargeError(60_000, 50_000);
    });
    const event = makeRouteEvent({ user: safeUser(u) });
    const r = await captureFlow(() => GET(event as unknown as Parameters<typeof GET>[0]));
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.status).toBe(413);
      expect(r.message).toMatch(/contactez-nous|trop volumineux/i);
    }
  });

  it('rethrows unexpected errors from exportUserData', async () => {
    const u = await seedUser();
    exportSpy.fn.mockImplementation(() => {
      throw new Error('unexpected');
    });
    const event = makeRouteEvent({ user: safeUser(u) });
    expect(() => GET(event as unknown as Parameters<typeof GET>[0])).toThrow('unexpected');
  });
});
