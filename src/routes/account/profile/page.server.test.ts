import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { makeRouteEvent, safeUser, seedUser } from '../../../test/route';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

import { hashPassword } from '#lib/server/auth.js';
import { users } from '#lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { actions, load } from './+page.server';
import { captureFlow } from '../../../test/route';

beforeEach(async () => {
  await resetTestDb();
});

async function seed() {
  return seedUser({
    email: 'p@example.com',
    passwordHash: await hashPassword('current-password-12')
  });
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

  it('refuses a displayName of only spaces and keeps the stored name (#506)', async () => {
    const u = await seed();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { displayName: '   ' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { profileErrorKey: string } };
    expect(r.status).toBe(400);
    expect(r.data.profileErrorKey).toBe('errorsAccountProfileNameInvalid');
    const fresh = (await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0];
    expect(fresh?.displayName).toBe(u.displayName);
  });

  it('applies the 80-character limit to the trimmed name', async () => {
    const u = await seed();
    const name = 'a'.repeat(80);
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { displayName: `  ${name}  ` }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { profileSuccessKey: string };
    expect(r.profileSuccessKey).toBe('errorsAccountProfileSuccess');
    const fresh = (await testDb.select().from(users).where(eq(users.id, u.id)).limit(1))[0];
    expect(fresh?.displayName).toBe(name);
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
