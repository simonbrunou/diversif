import { describe, it, expect, vi } from 'vitest';
import { testDb } from '../../../../test/db';
import { makeRouteEvent } from '../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { load } from './+page.server';

describe('child/[id]/guide load', () => {
  it('returns ageMonths and currentStageId for the child', async () => {
    const event = makeRouteEvent({
      parent: async () => ({ child: { birthDate: '2024-01-01' } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(typeof out.ageMonths).toBe('number');
    expect(out.currentStageId).toMatch(/4-6|6-9|9-12|12-36/);
  });

  it('returns 4-6 stage for a very young child', async () => {
    const recent = new Date();
    const dateStr = `${recent.getFullYear()}-${String(recent.getMonth() + 1).padStart(2, '0')}-${String(recent.getDate()).padStart(2, '0')}`;
    const event = makeRouteEvent({
      parent: async () => ({ child: { birthDate: dateStr } })
    });
    const out = await load(event as unknown as Parameters<typeof load>[0]);
    expect(out.currentStageId).toBe('4-6');
  });
});
