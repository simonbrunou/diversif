import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { makeRouteEvent, safeUser } from '../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { hashPassword } from '$lib/server/auth';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { actions, load } from './+page.server';
import { captureFlow } from '../../../test/route';

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

describe('account/profile load', () => {
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

describe('account/profile updateProfile', () => {
  it('fails when displayName is empty', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { displayName: '' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number };
    expect(r.status).toBe(400);
  });

  it('updates the displayName on success', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { displayName: '  New Name  ' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { profileSuccessKey: string };
    expect(r.profileSuccessKey).toBeTruthy();
    const fresh = (await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0];
    expect(fresh?.displayName).toBe('New Name');
  });
});
