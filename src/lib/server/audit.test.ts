import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { audit } from './audit';

describe('audit', () => {
  afterEach(() => {
    mock.restore();
  });

  it('emits a single JSON line to stdout with ts + level + payload', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
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
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    audit({ type: 'account.exported', userId: 7, foodEntryCount: 1234 });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: 'audit',
      type: 'account.exported',
      userId: 7,
      foodEntryCount: 1234
    });
  });

  it('emits the export_blocked event with the refusal reason and counts', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    audit({
      type: 'account.export_blocked',
      userId: 9,
      reason: 'too_large',
      count: 51_234,
      limit: 50_000
    });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed).toMatchObject({
      level: 'audit',
      type: 'account.export_blocked',
      userId: 9,
      reason: 'too_large',
      count: 51_234,
      limit: 50_000
    });
  });

  it('emits credential lifecycle events with the userId (and passkeyId where relevant)', () => {
    const spy = spyOn(console, 'log').mockImplementation(() => {});
    audit({ type: 'account.password_changed', userId: 11 });
    audit({ type: 'account.passkey_added', userId: 11, passkeyId: 'pk-A' });
    audit({ type: 'account.passkey_renamed', userId: 11, passkeyId: 'pk-A' });
    audit({ type: 'account.passkey_deleted', userId: 11, passkeyId: 'pk-A' });
    audit({ type: 'account.sessions_revoked', userId: 11 });

    const parsed = spy.mock.calls.map((c) => JSON.parse(c[0] as string));
    expect(parsed.map((p) => p.type)).toEqual([
      'account.password_changed',
      'account.passkey_added',
      'account.passkey_renamed',
      'account.passkey_deleted',
      'account.sessions_revoked'
    ]);
    expect(parsed.every((p) => p.level === 'audit' && p.userId === 11)).toBe(true);
    expect(parsed[1].passkeyId).toBe('pk-A');
    expect(parsed[2].passkeyId).toBe('pk-A');
    expect(parsed[3].passkeyId).toBe('pk-A');
  });
});
