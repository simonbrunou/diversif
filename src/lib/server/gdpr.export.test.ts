import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';

vi.mock('$lib/server/db', () => ({ db: testDb }));

const auditSpy = vi.fn();
vi.mock('./audit', async () => {
  const actual = await vi.importActual<typeof import('./audit')>('./audit');
  return { ...actual, audit: (...args: Parameters<typeof actual.audit>) => auditSpy(...args) };
});

import { ExportTooLargeError, exportUserData } from './gdpr';
import { invitations, passkeys, tipDismissals, users } from './db/schema';
import { eq } from 'drizzle-orm';
import {
  insertChild,
  insertEntry,
  insertFood,
  insertMembership,
  insertUser
} from './gdpr-test-fixtures';

beforeEach(async () => {
  await resetTestDb();
  auditSpy.mockClear();
});

describe('exportUserData', () => {
  it('throws for unknown users', async () => {
    await expect(exportUserData(99_999)).rejects.toThrow();
  });

  it('returns the expected shape with redactions', async () => {
    const u = await insertUser('export@example.com', 'Eve');
    const c = await insertChild('Léa', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const food = await insertFood('Banane');
    await insertEntry(c.id, food.id, u.id);
    await testDb.insert(passkeys).values({
      id: 'pk-export',
      userId: u.id,
      publicKey: 'SECRET-PUBLIC-KEY',
      counter: 42,
      transports: ['internal'],
      deviceType: 'multiDevice',
      backedUp: true,
      name: 'iPhone',
      createdAt: new Date()
    });

    // Stamp lastExportAt so the assertion below isn't testing only the null
    // path : every export operation flips this field on the users row, so a
    // returning user's archive should reflect their previous export.
    await testDb
      .update(users)
      .set({ lastExportAt: new Date('2026-04-01T00:00:00Z') })
      .where(eq(users.id, u.id));

    const out = await exportUserData(u.id);
    expect(out.generator).toBe('diversif');
    expect(out.schemaVersion).toBe(1);
    expect(out.profile.email).toBe('export@example.com');
    expect(out.profile.displayName).toBe('Eve');
    expect(out.profile.lastExportAt).toBe('2026-04-01T00:00:00.000Z');
    expect(out.children).toHaveLength(1);
    expect(out.children[0].name).toBe('Léa');
    expect(out.children[0].membership.role).toBe('owner');
    expect(out.children[0].foodEntries).toHaveLength(1);
    expect(out.children[0].foodEntries[0].foodName).toBe('Banane');
    expect(out.children[0].foodEntries[0].loggedByMe).toBe(true);
    expect(out.passkeys).toHaveLength(1);
    expect(out.passkeys[0].id).toBe('pk-export');
    // Public key, counter and password hash must NOT be in the export.
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('SECRET-PUBLIC-KEY');
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('counter');
  });

  it('returns empty children list when user has no memberships', async () => {
    const u = await insertUser('alone@example.com');
    const out = await exportUserData(u.id);
    expect(out.children).toEqual([]);
    expect(out.passkeys).toEqual([]);
  });

  it('returns child with empty foodEntries when nothing has been logged yet', async () => {
    const u = await insertUser('blank@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const out = await exportUserData(u.id);
    expect(out.children).toHaveLength(1);
    expect(out.children[0].foodEntries).toEqual([]);
  });

  it('exports invitations the user sent and accepted, with the right relationship', async () => {
    const inviter = await insertUser('inviter@example.com');
    const c = await insertChild('Bébé', inviter.id);
    await insertMembership(inviter.id, c.id, 'owner');
    const accepted = await insertUser('joiner@example.com');
    const childOfAccepted = await insertChild('Léo', accepted.id);
    await insertMembership(accepted.id, childOfAccepted.id, 'owner');

    // Invite #1 : sent by `inviter`, never used
    await testDb.insert(invitations).values({
      code: 'INV-SENT',
      childId: c.id,
      createdBy: inviter.id,
      createdAt: new Date('2026-05-01'),
      expiresAt: new Date('2026-05-08'),
      usedAt: null,
      usedBy: null
    });
    // Invite #2 : sent by someone else, accepted by `accepted`
    await testDb.insert(invitations).values({
      code: 'INV-ACCEPTED',
      childId: childOfAccepted.id,
      createdBy: inviter.id,
      createdAt: new Date('2026-05-02'),
      expiresAt: new Date('2026-05-09'),
      usedAt: new Date('2026-05-03'),
      usedBy: accepted.id
    });

    const senderOut = await exportUserData(inviter.id);
    expect(senderOut.invitations).toHaveLength(2);
    // Ordered by createdAt: INV-SENT first (2026-05-01), INV-ACCEPTED second
    // (2026-05-02). Identify by usedAt rather than code (code is intentionally
    // absent from the export : see ExportedUser.invitations docstring).
    expect(senderOut.invitations[0]).toMatchObject({ relationship: 'sent', usedAt: null });
    expect(senderOut.invitations[1].relationship).toBe('sent');
    expect(senderOut.invitations[1].usedAt).not.toBeNull();

    const accepterOut = await exportUserData(accepted.id);
    expect(accepterOut.invitations).toHaveLength(1);
    expect(accepterOut.invitations[0].relationship).toBe('accepted');
    expect(accepterOut.invitations[0].usedAt).not.toBeNull();

    // Regression guard for the bearer-token leak: invitation `code` is the
    // join token and must never end up in the downloadable archive.
    const serialized = JSON.stringify(senderOut) + JSON.stringify(accepterOut);
    expect(serialized).not.toContain('INV-SENT');
    expect(serialized).not.toContain('INV-ACCEPTED');
  });

  it('exports both invitation relationships when the same user sent and accepted a code', async () => {
    const user = await insertUser('self-invite@example.com');
    const child = await insertChild('Léo', user.id);
    await insertMembership(user.id, child.id, 'owner');

    await testDb.insert(invitations).values({
      code: 'INV-SELF',
      childId: child.id,
      createdBy: user.id,
      createdAt: new Date('2026-05-04'),
      expiresAt: new Date('2026-05-11'),
      usedAt: new Date('2026-05-05'),
      usedBy: user.id
    });

    const out = await exportUserData(user.id);

    expect(out.invitations).toEqual([
      {
        childId: child.id,
        relationship: 'sent',
        createdAt: new Date('2026-05-04').toISOString(),
        expiresAt: new Date('2026-05-11').toISOString(),
        usedAt: new Date('2026-05-05').toISOString()
      },
      {
        childId: child.id,
        relationship: 'accepted',
        createdAt: new Date('2026-05-04').toISOString(),
        expiresAt: new Date('2026-05-11').toISOString(),
        usedAt: new Date('2026-05-05').toISOString()
      }
    ]);
    expect(JSON.stringify(out)).not.toContain('INV-SELF');
  });

  it('exports tipDismissals scoped to the user and their children', async () => {
    const u = await insertUser('dismisser@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    // Other user's dismissal : must not leak.
    const other = await insertUser('other@example.com');
    const otherChild = await insertChild('Léo', other.id);
    await insertMembership(other.id, otherChild.id, 'owner');
    await testDb.insert(tipDismissals).values({
      userId: other.id,
      childId: otherChild.id,
      reminderKey: 'priority-allergens',
      dismissedAt: new Date('2026-05-01')
    });
    await testDb.insert(tipDismissals).values({
      userId: u.id,
      childId: c.id,
      reminderKey: 'priority-allergens',
      dismissedAt: new Date('2026-05-02')
    });
    await testDb.insert(tipDismissals).values({
      userId: u.id,
      childId: c.id,
      reminderKey: 'first-foods',
      dismissedAt: new Date('2026-05-03')
    });

    const out = await exportUserData(u.id);
    expect(out.tipDismissals).toHaveLength(2);
    expect(out.tipDismissals.map((t) => t.reminderKey)).toEqual([
      'priority-allergens',
      'first-foods'
    ]);
    expect(out.tipDismissals.every((t) => t.childId === c.id)).toBe(true);
  });

  it('marks entries logged by another member as not loggedByMe', async () => {
    const owner = await insertUser('owner@example.com');
    const member = await insertUser('member@example.com');
    const c = await insertChild('Bébé', owner.id);
    await insertMembership(owner.id, c.id, 'owner');
    await insertMembership(member.id, c.id, 'member');
    const food = await insertFood('Riz');
    await insertEntry(c.id, food.id, owner.id);

    const out = await exportUserData(member.id);
    expect(out.children[0].foodEntries[0].loggedByMe).toBe(false);
  });

  it('throws ExportTooLargeError when food entries exceed the cap', async () => {
    const u = await insertUser('big@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const food = await insertFood('Riz');
    // Seed 3 entries; pass a cap of 2 so the threshold trips without
    // having to insert tens of thousands of rows.
    await insertEntry(c.id, food.id, u.id);
    await insertEntry(c.id, food.id, u.id);
    await insertEntry(c.id, food.id, u.id);
    await expect(exportUserData(u.id, 2)).rejects.toThrow(ExportTooLargeError);
    try {
      await exportUserData(u.id, 2);
    } catch (err) {
      if (err instanceof ExportTooLargeError) {
        expect(err.count).toBe(3);
        expect(err.limit).toBe(2);
      } else {
        throw err;
      }
    }
  });

  it('emits an account.export_blocked audit event when the cap trips', async () => {
    const u = await insertUser('refused@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const food = await insertFood('Riz');
    await insertEntry(c.id, food.id, u.id);
    await insertEntry(c.id, food.id, u.id);

    await expect(exportUserData(u.id, 1)).rejects.toThrow(ExportTooLargeError);

    expect(auditSpy).toHaveBeenCalledOnce();
    expect(auditSpy).toHaveBeenCalledWith({
      type: 'account.export_blocked',
      userId: u.id,
      reason: 'too_large',
      count: 2,
      limit: 1
    });
  });

  it('exports normally when entry count equals the cap', async () => {
    const u = await insertUser('exact@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const food = await insertFood('Riz');
    await insertEntry(c.id, food.id, u.id);
    await insertEntry(c.id, food.id, u.id);
    const out = await exportUserData(u.id, 2);
    expect(out.children[0].foodEntries).toHaveLength(2);
  });

  it('emits an account.exported audit event with the entry count', async () => {
    const u = await insertUser('exporter@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const food = await insertFood('Banane');
    await insertEntry(c.id, food.id, u.id);
    await insertEntry(c.id, food.id, u.id);
    await insertEntry(c.id, food.id, u.id);

    await exportUserData(u.id);

    expect(auditSpy).toHaveBeenCalledOnce();
    expect(auditSpy).toHaveBeenCalledWith({
      type: 'account.exported',
      userId: u.id,
      foodEntryCount: 3
    });
  });

  it('includes texture in exported food entries', async () => {
    const u = await insertUser('texture-export@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const food = await insertFood('Patate douce');
    await insertEntry(c.id, food.id, u.id, 'ecrasee');
    await insertEntry(c.id, food.id, u.id, null);

    const out = await exportUserData(u.id);
    const entries = out.children[0].foodEntries;
    expect(entries).toHaveLength(2);
    expect(entries[0].texture).toBe('ecrasee');
    expect(entries[1].texture).toBeNull();
  });
});
