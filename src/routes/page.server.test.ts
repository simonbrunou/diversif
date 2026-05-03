import { describe, it, expect, vi } from 'vitest';
import { testDb } from '../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { load } from './+page.server';

const fakeUser = {
  id: 1,
  email: 'a@example.com',
  displayName: 'A',
  createdAt: new Date()
} as const;

describe('+page.server load', () => {
  it('returns landing kind for guests', async () => {
    const out = await load(makeRouteEvent({ user: null }) as unknown as Parameters<typeof load>[0]);
    expect(out).toEqual({ kind: 'landing' });
  });

  it('redirects to /child/new when user has no children', async () => {
    const event = makeRouteEvent({
      user: safeUser({ ...fakeUser }),
      parent: async () => ({ children: [] })
    });
    const result = await captureFlow(() => load(event as unknown as Parameters<typeof load>[0]));
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect') {
      expect(result.location).toBe('/child/new');
    }
  });

  it('redirects to /child/{id} when user has exactly one child', async () => {
    const event = makeRouteEvent({
      user: safeUser({ ...fakeUser }),
      parent: async () => ({
        children: [{ id: 42, name: 'Bébé', birthDate: '2024-01-01', role: 'owner' }]
      })
    });
    const result = await captureFlow(() => load(event as unknown as Parameters<typeof load>[0]));
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect') {
      expect(result.location).toBe('/child/42');
    }
  });

  it('returns picker kind when user has multiple children', async () => {
    const children = [
      { id: 1, name: 'A', birthDate: '2024-01-01', role: 'owner' },
      { id: 2, name: 'B', birthDate: '2024-02-01', role: 'member' }
    ];
    const event = makeRouteEvent({
      user: safeUser({ ...fakeUser }),
      parent: async () => ({ children })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out).toEqual({ kind: 'picker', children });
  });
});
