import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser, seedUser } from '../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { hashPassword } from '$lib/server/auth';
import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { passkeys } from '$lib/server/db/schema';
import { load } from './+page.server';
import { seedChild, seedMembership } from '../../test/route';

beforeEach(async () => {
  await resetTestDb();
  _clearAllRateLimits();
});

async function seed() {
  return seedUser({
    email: 'p@example.com',
    passwordHash: await hashPassword('current-password-12')
  });
}

describe('account load', () => {
  it('redirects unauthenticated users to /login', async () => {
    const r = await captureFlow(() =>
      load(makeRouteEvent({ user: null }) as unknown as Parameters<typeof load>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('returns the passkey list for authenticated users', async () => {
    const u = await seed();
    await testDb.insert(passkeys).values({
      id: 'p1',
      userId: u.id,
      publicKey: 'a',
      counter: 0,
      transports: [],
      deviceType: 'singleDevice',
      backedUp: false,
      name: 'Phone',
      createdAt: new Date(),
      lastUsedAt: null
    });
    const out = await load(
      makeRouteEvent({ user: safeUser(u) }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.passkeys.length).toBe(1);
    expect(out.passkeys[0].id).toBe('p1');
  });
});

describe('account load : bento data', () => {
  it('returns children, locale, theme alongside passkeys', async () => {
    const u = await seed();
    const coparent = await seedUser({ email: 'coparent@example.com', displayName: 'Coparent' });
    const child = await seedChild({ name: 'Léa', birthDate: '2024-06-01', createdBy: u.id });
    await seedMembership({ userId: u.id, childId: child.id, role: 'owner' });
    await seedMembership({ userId: coparent.id, childId: child.id, role: 'member' });

    const event = makeRouteEvent({ user: safeUser(u) });

    const out = await load(event as unknown as Parameters<typeof load>[0]);

    expect(Array.isArray(out.children)).toBe(true);
    expect(out.children.length).toBe(1);
    expect(out.children[0].name).toBe('Léa');
    expect(out.children[0].id).toBe(String(child.id));
    expect(typeof out.children[0].ageMonths).toBe('number');

    expect(out.children[0].coparents.length).toBe(1);
    expect(out.children[0].coparents[0].id).toBe(String(coparent.id));
    expect(out.children[0].coparents[0].displayName).toBe('Coparent');
    expect(out.children[0].coparents[0].role).toBe('member');

    expect(out.locale).toBe('fr');
    expect(out.theme).toBe('system');
    expect(Array.isArray(out.passkeys)).toBe(true);
  });

  it('picks up locale from locals', async () => {
    const u = await seed();
    const event = makeRouteEvent({ user: safeUser(u), locale: 'en' });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.locale).toBe('en');
  });

  it('reads a valid theme cookie', async () => {
    const u = await seed();
    const event = makeRouteEvent({ user: safeUser(u) });
    event.cookies.set('theme', 'dark', {});
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.theme).toBe('dark');
  });

  it('falls back theme to system for an invalid cookie value', async () => {
    const u = await seed();
    const event = makeRouteEvent({ user: safeUser(u) });
    event.cookies.set('theme', 'purple', {});
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.theme).toBe('system');
  });
});
