import { describe, it, expect, vi } from 'vitest';
import { testDb } from '../../test/db';
import { makeRouteEvent } from '../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { load } from './+page.server';

describe('sources +page.server load', () => {
  it('returns an empty payload', async () => {
    const event = makeRouteEvent();
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out).toEqual({});
  });
});
