import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../test/db';
import {
  captureFlow,
  makeRouteEvent,
  safeUser,
  seedChild,
  seedMembership,
  seedUser
} from '../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { load } from './+layout.server';

beforeEach(async () => {
  await resetTestDb();
});

describe('child/[id] +layout.server load', () => {
  it('redirects guests', async () => {
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({ user: null, params: { id: '1' } }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('redirect');
  });

  it('errors 404 on non-integer id', async () => {
    const u = await seedUser();
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(u),
          params: { id: 'abc' }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(404);
  });

  it('errors 404 on id <= 0', async () => {
    const u = await seedUser();
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(u),
          params: { id: '0' }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(404);
  });

  it('errors 403 when user has no membership', async () => {
    const u = await seedUser();
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(u),
          params: { id: '7' }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(403);
  });

  it('errors 404 when child row is missing despite membership', async () => {
    const u = await seedUser();
    // Construct a membership for a non-existent child id.
    const fakeMembership = {
      userId: u.id,
      childId: 999,
      role: 'owner' as const,
      createdAt: new Date()
    };
    const r = await captureFlow(() =>
      load(
        makeRouteEvent({
          user: safeUser(u),
          memberships: [fakeMembership],
          params: { id: '999' }
        }) as unknown as Parameters<typeof load>[0]
      )
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(404);
  });

  it('returns the child + membership when authorized', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id, name: 'Lulu' });
    const m = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const out = await load(
      makeRouteEvent({
        user: safeUser(u),
        memberships: [m],
        params: { id: String(c.id) }
      }) as unknown as Parameters<typeof load>[0]
    );
    expect(out.child.id).toBe(c.id);
    expect(out.child.name).toBe('Lulu');
    expect(out.membership.role).toBe('owner');
  });
});
