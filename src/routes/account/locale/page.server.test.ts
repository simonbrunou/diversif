import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, makeRouteEvent, safeUser, seedUser } from '../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { hashPassword } from '$lib/server/auth';
import { load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
});

async function seed() {
  return seedUser({
    email: 'p@example.com',
    passwordHash: await hashPassword('current-password-12')
  });
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
