import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

describe('mentions-legales load', () => {
  it('returns the legal identity', async () => {
    const out = await load({} as Parameters<typeof load>[0]);
    expect(out).toBeDefined();
    expect(out.legal).toBeDefined();
    expect(typeof out.legal.controllerName).toBe('string');
    expect(out.legal.retentionInactiveDays).toBeGreaterThan(0);
  });
});
