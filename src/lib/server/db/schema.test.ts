import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import {
  users,
  sessions,
  children,
  memberships,
  invitations,
  foods,
  foodEntries,
  tipDismissals,
  passkeys,
  webauthnChallenges,
  symptoms
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
      tipDismissals,
      passkeys,
      webauthnChallenges,
      symptoms
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

  it('passkeys exposes a user_id index', () => {
    const cfg = getTableConfig(passkeys);
    const idx = cfg.indexes.find((i) => i.config.name === 'passkeys_user_idx');
    expect(idx).toBeDefined();
  });
});

describe('symptoms table', () => {
  it('is defined and has the expected columns', () => {
    expect(symptoms).toBeDefined();
    const cfg = getTableConfig(symptoms);
    const cols = cfg.columns.map((c) => c.name).sort();
    expect(cols).toEqual([
      'child_id',
      'created_at',
      'created_by',
      'food_entry_id',
      'id',
      'label',
      'note',
      'observed_at'
    ]);
  });

  it('indexes food_entry_id and (child_id, observed_at)', () => {
    const cfg = getTableConfig(symptoms);
    const idxNames = cfg.indexes.map((i) => i.config.name).sort();
    expect(idxNames).toContain('symptoms_food_entry_id_idx');
    expect(idxNames).toContain('symptoms_child_id_observed_at_idx');
  });
});
