import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import {
  users,
  sessions,
  children,
  memberships,
  invitations,
  foods,
  foodEntries,
  tipDismissals
} from './schema';

describe('schema exports', () => {
  it('every table is defined and has columns', () => {
    for (const table of [
      users,
      sessions,
      children,
      memberships,
      invitations,
      foods,
      foodEntries,
      tipDismissals
    ]) {
      expect(table).toBeDefined();
      expect(typeof table).toBe('object');
    }
  });

  it('memberships exposes a composite primary key on (user_id, child_id)', () => {
    const cfg = getTableConfig(memberships);
    expect(cfg.primaryKeys.length).toBe(1);
    const cols = cfg.primaryKeys[0].columns.map((c) => c.name).sort();
    expect(cols).toEqual(['child_id', 'user_id']);
  });

  it('food_entries exposes a child/given_at index', () => {
    const cfg = getTableConfig(foodEntries);
    const idx = cfg.indexes.find((i) => i.config.name === 'food_entries_child_idx');
    expect(idx).toBeDefined();
  });

  it('tip_dismissals exposes a composite primary key on (user_id, child_id, reminder_key)', () => {
    const cfg = getTableConfig(tipDismissals);
    expect(cfg.primaryKeys.length).toBe(1);
    const cols = cfg.primaryKeys[0].columns.map((c) => c.name).sort();
    expect(cols).toEqual(['child_id', 'reminder_key', 'user_id']);
  });
});
