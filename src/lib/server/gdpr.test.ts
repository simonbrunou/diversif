import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { deleteUserAccount, ExportTooLargeError, exportUserData } from './gdpr';
import {
  children,
  foodEntries,
  foods,
  invitations,
  memberships,
  passkeys,
  sessions,
  tipDismissals,
  users
} from './db/schema';
import { and, eq } from 'drizzle-orm';

async function insertUser(email: string, displayName = email) {
  const u = await testDb
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash: 'argon$placeholder',
      displayName,
      createdAt: new Date(),
      tosAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      ageConfirmedAt: new Date(),
      lastLoginAt: new Date()
    })
    .returning();
  return u[0];
}

async function insertChild(name: string, createdBy: number) {
  return (
    await testDb
      .insert(children)
      .values({ name, birthDate: '2024-01-01', createdBy, createdAt: new Date() })
      .returning()
  )[0];
}

async function insertMembership(
  userId: number,
  childId: number,
  role: 'owner' | 'member',
  createdAt = new Date()
) {
  await testDb.insert(memberships).values({ userId, childId, role, createdAt });
}

async function insertFood(name: string, category = 'fruit') {
  return (
    await testDb
      .insert(foods)
      .values({ name, category, isMajorAllergen: false, suggestedAgeMonths: 6 })
      .returning()
  )[0];
}

async function insertEntry(childId: number, foodId: number, loggedBy: number) {
  return (
    await testDb
      .insert(foodEntries)
      .values({
        childId,
        foodId,
        givenAt: new Date(),
        reaction: 'ras',
        loggedBy,
        createdAt: new Date()
      })
      .returning()
  )[0];
}

beforeEach(async () => {
  await resetTestDb();
});

describe('deleteUserAccount', () => {
  it('deletes a user with no memberships', async () => {
    const u = await insertUser('lone@example.com');
    const summary = await deleteUserAccount(u.id);
    expect(summary).toEqual({ deletedChildren: 0, promotedMemberships: 0, removedMemberships: 0 });
    expect(await testDb.select().from(users)).toHaveLength(0);
  });

  it('drops every live session for the deleted user (revocation across devices)', async () => {
    const u = await insertUser('many-sessions@example.com');
    const other = await insertUser('keep-me@example.com');
    // Three live sessions for the user being deleted, plus one for someone else
    // who must NOT be touched. Deletion has to revoke all of u's sessions
    // atomically so a parallel device can't keep transacting on the dead row.
    const future = new Date(Date.now() + 86400_000);
    await testDb.insert(sessions).values([
      { id: 'sess-a', userId: u.id, expiresAt: future },
      { id: 'sess-b', userId: u.id, expiresAt: future },
      { id: 'sess-c', userId: u.id, expiresAt: future },
      { id: 'sess-other', userId: other.id, expiresAt: future }
    ]);

    await deleteUserAccount(u.id);

    const remaining = await testDb.select().from(sessions);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('sess-other');
  });

  it('cascades child deletion when sole owner with no other members', async () => {
    const u = await insertUser('only@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const food = await insertFood('Carotte');
    await insertEntry(c.id, food.id, u.id);

    const summary = await deleteUserAccount(u.id);
    expect(summary.deletedChildren).toBe(1);
    expect(summary.removedMemberships).toBe(0);
    expect(await testDb.select().from(children)).toHaveLength(0);
    expect(await testDb.select().from(foodEntries)).toHaveLength(0);
    expect(await testDb.select().from(memberships)).toHaveLength(0);
    expect(await testDb.select().from(users)).toHaveLength(0);
  });

  it('promotes earliest member when sole owner leaves a shared child', async () => {
    const owner = await insertUser('owner@example.com');
    const memberA = await insertUser('a@example.com');
    const memberB = await insertUser('b@example.com');
    const c = await insertChild('Bébé', owner.id);
    await insertMembership(owner.id, c.id, 'owner', new Date(1000));
    await insertMembership(memberB.id, c.id, 'member', new Date(3000));
    await insertMembership(memberA.id, c.id, 'member', new Date(2000));

    const summary = await deleteUserAccount(owner.id);
    expect(summary.promotedMemberships).toBe(1);
    expect(summary.deletedChildren).toBe(0);

    const remaining = await testDb.select().from(memberships).where(eq(memberships.childId, c.id));
    expect(remaining).toHaveLength(2);
    const promoted = remaining.find((m) => m.userId === memberA.id);
    expect(promoted?.role).toBe('owner');
    const stillMember = remaining.find((m) => m.userId === memberB.id);
    expect(stillMember?.role).toBe('member');
  });

  it('falls back to lowest userId when joined-at timestamps tie', async () => {
    const owner = await insertUser('owner@example.com');
    const a = await insertUser('a@example.com');
    const b = await insertUser('b@example.com');
    const c = await insertChild('Bébé', owner.id);
    const ts = new Date(2000);
    await insertMembership(owner.id, c.id, 'owner', new Date(1000));
    await insertMembership(b.id, c.id, 'member', ts);
    await insertMembership(a.id, c.id, 'member', ts);

    await deleteUserAccount(owner.id);

    const promoted = await testDb
      .select()
      .from(memberships)
      .where(and(eq(memberships.childId, c.id), eq(memberships.role, 'owner')));
    expect(promoted).toHaveLength(1);
    // a.id < b.id since a was inserted first.
    expect(promoted[0].userId).toBe(a.id);
  });

  it('does not promote when another owner remains', async () => {
    const o1 = await insertUser('o1@example.com');
    const o2 = await insertUser('o2@example.com');
    const c = await insertChild('Bébé', o1.id);
    await insertMembership(o1.id, c.id, 'owner');
    await insertMembership(o2.id, c.id, 'owner');

    const summary = await deleteUserAccount(o1.id);
    expect(summary.promotedMemberships).toBe(0);
    expect(summary.removedMemberships).toBe(1);

    const remaining = await testDb.select().from(memberships).where(eq(memberships.childId, c.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe(o2.id);
    expect(remaining[0].role).toBe('owner');
  });

  it('removes a non-owner membership without touching the child', async () => {
    const owner = await insertUser('o@example.com');
    const member = await insertUser('m@example.com');
    const c = await insertChild('Bébé', owner.id);
    await insertMembership(owner.id, c.id, 'owner');
    await insertMembership(member.id, c.id, 'member');

    const summary = await deleteUserAccount(member.id);
    expect(summary).toEqual({ deletedChildren: 0, promotedMemberships: 0, removedMemberships: 1 });
    expect(await testDb.select().from(children)).toHaveLength(1);
    expect(await testDb.select().from(memberships)).toHaveLength(1);
  });

  it('preserves food entries from a deleted member by nulling logged_by', async () => {
    const owner = await insertUser('o@example.com');
    const member = await insertUser('m@example.com');
    const c = await insertChild('Bébé', owner.id);
    await insertMembership(owner.id, c.id, 'owner');
    await insertMembership(member.id, c.id, 'member');
    const food = await insertFood('Pomme');
    const entry = await insertEntry(c.id, food.id, member.id);

    await deleteUserAccount(member.id);
    const remaining = await testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].loggedBy).toBeNull();
  });

  it('cascades sessions, passkeys and tip dismissals', async () => {
    const u = await insertUser('me@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    await testDb
      .insert(sessions)
      .values({ id: 'sess1', userId: u.id, expiresAt: new Date(Date.now() + 100000) });
    await testDb.insert(passkeys).values({
      id: 'pk1',
      userId: u.id,
      publicKey: 'k',
      counter: 0,
      transports: [],
      deviceType: 'singleDevice',
      backedUp: false,
      name: 'Téléphone',
      createdAt: new Date()
    });
    await testDb
      .insert(tipDismissals)
      .values({ userId: u.id, childId: c.id, reminderKey: 'k', dismissedAt: new Date() });

    await deleteUserAccount(u.id);

    expect(await testDb.select().from(sessions)).toHaveLength(0);
    expect(await testDb.select().from(passkeys)).toHaveLength(0);
    expect(await testDb.select().from(tipDismissals)).toHaveLength(0);
  });

  it('frees the email for re-signup', async () => {
    const u = await insertUser('reuse@example.com');
    await deleteUserAccount(u.id);
    const u2 = await insertUser('reuse@example.com');
    expect(u2.id).not.toBe(u.id);
  });
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

    const out = await exportUserData(u.id);
    expect(out.generator).toBe('diversif');
    expect(out.schemaVersion).toBe(1);
    expect(out.profile.email).toBe('export@example.com');
    expect(out.profile.displayName).toBe('Eve');
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

    // Invite #1 — sent by `inviter`, never used
    await testDb.insert(invitations).values({
      code: 'INV-SENT',
      childId: c.id,
      createdBy: inviter.id,
      createdAt: new Date('2026-05-01'),
      expiresAt: new Date('2026-05-08'),
      usedAt: null,
      usedBy: null
    });
    // Invite #2 — sent by someone else, accepted by `accepted`
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
    expect(senderOut.invitations.map((i) => i.code)).toEqual(['INV-SENT', 'INV-ACCEPTED']);
    expect(senderOut.invitations[0].relationship).toBe('sent');
    expect(senderOut.invitations[0].usedAt).toBeNull();
    expect(senderOut.invitations[1].relationship).toBe('sent');

    const accepterOut = await exportUserData(accepted.id);
    expect(accepterOut.invitations.map((i) => i.code)).toEqual(['INV-ACCEPTED']);
    expect(accepterOut.invitations[0].relationship).toBe('accepted');
    expect(accepterOut.invitations[0].usedAt).not.toBeNull();
  });

  it('exports tipDismissals scoped to the user and their children', async () => {
    const u = await insertUser('dismisser@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    // Other user's dismissal — must not leak.
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
});
