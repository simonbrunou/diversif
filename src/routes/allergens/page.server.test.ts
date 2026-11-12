import { describe, expect, it, mock } from 'bun:test';
import { testDb } from '../../test/db';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

import { load } from './+page.server';

describe('allergens +page.server load', () => {
  it('returns an empty payload', async () => {
    const out = await load();
    expect(out).toEqual({});
  });
});
