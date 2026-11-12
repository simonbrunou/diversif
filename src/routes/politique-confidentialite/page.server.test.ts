import { describe, expect, it } from 'bun:test';
import { loadData } from '../../test/route';
import { load } from './+page.server';

describe('politique-confidentialite load', () => {
  it('returns the legal identity', async () => {
    const out = loadData(await load());
    expect(out).toBeDefined();
    expect(out.legal).toBeDefined();
    expect(typeof out.legal.controllerName).toBe('string');
  });
});
