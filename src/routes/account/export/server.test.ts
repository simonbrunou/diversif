import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { GET } from './+server';

beforeEach(() => {
  resetTestDb();
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
});
