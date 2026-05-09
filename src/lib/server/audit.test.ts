import { describe, it, expect, vi, afterEach } from 'vitest';
import { audit } from './audit';

describe('audit', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits a single JSON line to stdout with ts + level + payload', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    audit({
      type: 'account.deleted',
      userId: 42,
      deletedChildren: 1,
      promotedMemberships: 0,
      removedMemberships: 0
    });
    expect(spy).toHaveBeenCalledOnce();
    const line = spy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed).toMatchObject({
      level: 'audit',
      type: 'account.deleted',
      userId: 42,
      deletedChildren: 1,
      promotedMemberships: 0,
      removedMemberships: 0
    });
    expect(typeof parsed.ts).toBe('string');
    expect(new Date(parsed.ts).toString()).not.toBe('Invalid Date');
  });

  it('emits the export event with foodEntryCount', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    audit({ type: 'account.exported', userId: 7, foodEntryCount: 1234 });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: 'audit',
      type: 'account.exported',
      userId: 7,
      foodEntryCount: 1234
    });
  });
});
