import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { hashPassword } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

async function seed() {
  const passwordHash = await hashPassword('current-password-12');
  const u = (
    await testDb
      .insert(users)
      .values({
        email: 'p@example.com',
        passwordHash,
        displayName: 'Parent',
        createdAt: new Date()
      })
      .returning()
  )[0];
  return u;
}

describe('account/locale load', () => {
  it('redirects unauthenticated users to /login', async () => {
    const r = await captureFlow(() =>
      load(makeRouteEvent({ user: null }) as unknown as Parameters<typeof load>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('returns empty data for authenticated users', async () => {
    const u = await seed();
    const out = await load(
      makeRouteEvent({ user: safeUser(u) }) as unknown as Parameters<typeof load>[0]
    );
    expect(out).toEqual({});
  });
});
