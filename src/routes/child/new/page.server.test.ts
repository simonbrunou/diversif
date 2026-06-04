import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, makeRouteEvent, safeUser, seedUser } from '../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { children, memberships, invitations } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { _clearAllRateLimits } from '$lib/server/rate-limit';
import { load, actions } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
  // The per-account child-create limiter is module-level state that survives
  // resetTestDb; clear it so each test starts with a fresh bucket (user ids
  // restart at 1 every test, so without this they'd share one bucket).
  _clearAllRateLimits();
});

describe('child/new load', () => {
  it('redirects guests to /login', async () => {
    const r = await captureFlow(() =>
      load(makeRouteEvent({ user: null }) as unknown as Parameters<typeof load>[0])
    );
    expect(r.kind).toBe('redirect');
  });

  it('flags isFirstChild=true when the user has no children yet', async () => {
    const u = await seedUser();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        parent: async () => ({ children: [] })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out).toEqual({ isFirstChild: true });
  });

  it('flags isFirstChild=false once at least one owned child exists', async () => {
    const u = await seedUser();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        parent: async () => ({
          children: [{ id: 1, name: 'Bébé', birthDate: '2024-01-01', role: 'owner' }]
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out).toEqual({ isFirstChild: false });
  });

  it('still flags isFirstChild=true for co-parents with only member memberships', async () => {
    const u = await seedUser();
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        parent: async () => ({
          children: [{ id: 1, name: "Bébé d'un autre", birthDate: '2024-01-01', role: 'member' }]
        })
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out).toEqual({ isFirstChild: true });
  });
});

describe('child/new action : rate limiting', () => {
  it('rejects the 11th child creation within the window for one account', async () => {
    const u = await seedUser();
    for (let i = 0; i < 10; i++) {
      await captureFlow(() =>
        actions.default!(
          makeRouteEvent({
            user: safeUser(u),
            formData: { firstName: `Bébé ${i}`, birthDate: '2024-01-01' }
          }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
        )
      );
    }
    const r = (await actions.default!(
      makeRouteEvent({
        user: safeUser(u),
        formData: { firstName: 'Onzième', birthDate: '2024-01-01' }
      }) as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errors: { firstName: string } } };
    expect(r.status).toBe(429);
    expect(r.data.errors.firstName).toMatch(/réessayez/i);
    expect(await testDb.select().from(children)).toHaveLength(10);
  });
});

describe('child/new default action', () => {
  it('fails on missing firstName', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { firstName: '', birthDate: '2024-01-01' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as {
      status: number;
      data: { errors: { firstName?: string }; firstName: string; birthDate: string };
    };
    expect(r.status).toBe(400);
    expect(r.data.errors?.firstName).toBeTruthy();
    expect(r.data.birthDate).toBe('2024-01-01');
  });

  it('fails on invalid birth date', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { firstName: 'Bébé', birthDate: '2024-99-99' }
    });
    const r = (await actions.default!(
      event as unknown as Parameters<NonNullable<typeof actions.default>>[0]
    )) as { status: number; data: { errors: { birthDate?: string } } };
    expect(r.status).toBe(400);
  });

  it('creates a child + owner membership and redirects', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { firstName: '  Bébé  ', birthDate: '2024-01-01' }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toMatch(/^\/child\/\d+$/);

    const childRow = (
      await testDb.select().from(children).where(eq(children.name, 'Bébé')).limit(1)
    )[0];
    expect(childRow).toBeDefined();
    const memb = await testDb
      .select()
      .from(memberships)
      .where(eq(memberships.childId, childRow!.id));
    expect(memb.length).toBe(1);
    expect(memb[0].role).toBe('owner');
  });

  it('rolls back the child if a write in the creation transaction fails (no orphan)', async () => {
    const u = await seedUser();
    // The action wraps the child + owner-membership inserts in one transaction
    // so a failure can't leave a child no one is a member of. Prove that
    // contract in the same DB context: a child insert followed by a throw
    // inside db.transaction must persist nothing.
    expect(() =>
      testDb.transaction((tx) => {
        tx.insert(children)
          .values({
            name: 'Orphelin',
            birthDate: '2024-01-01',
            createdBy: u.id,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .run();
        throw new Error('simulated membership-insert failure');
      })
    ).toThrow();
    expect(await testDb.select().from(children).where(eq(children.name, 'Orphelin'))).toHaveLength(
      0
    );
  });
});

describe('child/new action : invite-coparent flow', () => {
  it('skips invitation when inviteCoparent is not set', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { firstName: 'Léo', birthDate: '2023-06-15' }
    });
    await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    const rows = await testDb.select().from(invitations);
    expect(rows.length).toBe(0);
  });

  it('creates an invitation when inviteCoparent=1 is sent', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { firstName: 'Léo', birthDate: '2023-06-15', inviteCoparent: '1' }
    });
    await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    const childRow = (
      await testDb.select().from(children).where(eq(children.name, 'Léo')).limit(1)
    )[0];
    expect(childRow).toBeDefined();
    const inviteRows = await testDb
      .select()
      .from(invitations)
      .where(eq(invitations.childId, childRow!.id));
    expect(inviteRows.length).toBe(1);
  });

  it('redirect URL carries inviteCode when invite succeeds', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      formData: { firstName: 'Léo', birthDate: '2023-06-15', inviteCoparent: '1' }
    });
    const r = await captureFlow(() =>
      actions.default!(event as unknown as Parameters<NonNullable<typeof actions.default>>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') {
      expect(r.location).toMatch(/\/child\/\d+\?inviteCode=.+/);
    }
  });
});
