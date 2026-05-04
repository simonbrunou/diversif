import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { deleteUserAccount, exportUserData } from './gdpr';
import {
  children,
  foodEntries,
  foods,
  memberships,
  passkeys,
  sessions,
  tipDismissals,
  users
} from './db/schema';
import { and, eq } from 'drizzle-orm';

async function insertUser(email: string, displayName = email) {
  const u = testDb
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
    .returning()
    .all();
  return u[0];
}

function insertChild(name: string, createdBy: number) {
  return testDb
    .insert(children)
    .values({ name, birthDate: '2024-01-01', createdBy, createdAt: new Date() })
    .returning()
    .all()[0];
}

function insertMembership(
  userId: number,
  childId: number,
  role: 'owner' | 'member',
  createdAt = new Date()
) {
  testDb.insert(memberships).values({ userId, childId, role, createdAt }).run();
}

function insertFood(name: string, category = 'fruit') {
  return testDb
    .insert(foods)
    .values({ name, category, isMajorAllergen: false, suggestedAgeMonths: 6 })
    .returning()
    .all()[0];
}

function insertEntry(childId: number, foodId: number, loggedBy: number) {
  return testDb
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
    .all()[0];
}

beforeEach(() => {
  resetTestDb();
});

describe('deleteUserAccount', () => {
  it('deletes a user with no memberships', async () => {
    const u = await insertUser('lone@example.com');
    const summary = deleteUserAccount(u.id);
    expect(summary).toEqual({ deletedChildren: 0, promotedMemberships: 0, removedMemberships: 0 });
    expect(testDb.select().from(users).all()).toHaveLength(0);
  });

  it('cascades child deletion when sole owner with no other members', async () => {
    const u = await insertUser('only@example.com');
    const c = insertChild('Bébé', u.id);
    insertMembership(u.id, c.id, 'owner');
    const food = insertFood('Carotte');
    insertEntry(c.id, food.id, u.id);

    const summary = deleteUserAccount(u.id);
    expect(summary.deletedChildren).toBe(1);
    expect(summary.removedMemberships).toBe(0);
    expect(testDb.select().from(children).all()).toHaveLength(0);
    expect(testDb.select().from(foodEntries).all()).toHaveLength(0);
    expect(testDb.select().from(memberships).all()).toHaveLength(0);
    expect(testDb.select().from(users).all()).toHaveLength(0);
  });

  it('promotes earliest member when sole owner leaves a shared child', async () => {
    const owner = await insertUser('owner@example.com');
    const memberA = await insertUser('a@example.com');
    const memberB = await insertUser('b@example.com');
    const c = insertChild('Bébé', owner.id);
    insertMembership(owner.id, c.id, 'owner', new Date(1000));
    insertMembership(memberB.id, c.id, 'member', new Date(3000));
    insertMembership(memberA.id, c.id, 'member', new Date(2000));

    const summary = deleteUserAccount(owner.id);
    expect(summary.promotedMemberships).toBe(1);
    expect(summary.deletedChildren).toBe(0);

    const remaining = testDb.select().from(memberships).where(eq(memberships.childId, c.id)).all();
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
    const c = insertChild('Bébé', owner.id);
    const ts = new Date(2000);
    insertMembership(owner.id, c.id, 'owner', new Date(1000));
    insertMembership(b.id, c.id, 'member', ts);
    insertMembership(a.id, c.id, 'member', ts);

    deleteUserAccount(owner.id);

    const promoted = testDb
      .select()
      .from(memberships)
      .where(and(eq(memberships.childId, c.id), eq(memberships.role, 'owner')))
      .all();
    expect(promoted).toHaveLength(1);
    // a.id < b.id since a was inserted first.
    expect(promoted[0].userId).toBe(a.id);
  });

  it('does not promote when another owner remains', async () => {
    const o1 = await insertUser('o1@example.com');
    const o2 = await insertUser('o2@example.com');
    const c = insertChild('Bébé', o1.id);
    insertMembership(o1.id, c.id, 'owner');
    insertMembership(o2.id, c.id, 'owner');

    const summary = deleteUserAccount(o1.id);
    expect(summary.promotedMemberships).toBe(0);
    expect(summary.removedMemberships).toBe(1);

    const remaining = testDb.select().from(memberships).where(eq(memberships.childId, c.id)).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe(o2.id);
    expect(remaining[0].role).toBe('owner');
  });

  it('removes a non-owner membership without touching the child', async () => {
    const owner = await insertUser('o@example.com');
    const member = await insertUser('m@example.com');
    const c = insertChild('Bébé', owner.id);
    insertMembership(owner.id, c.id, 'owner');
    insertMembership(member.id, c.id, 'member');

    const summary = deleteUserAccount(member.id);
    expect(summary).toEqual({ deletedChildren: 0, promotedMemberships: 0, removedMemberships: 1 });
    expect(testDb.select().from(children).all()).toHaveLength(1);
    expect(testDb.select().from(memberships).all()).toHaveLength(1);
  });

  it('preserves food entries from a deleted member by nulling logged_by', async () => {
    const owner = await insertUser('o@example.com');
    const member = await insertUser('m@example.com');
    const c = insertChild('Bébé', owner.id);
    insertMembership(owner.id, c.id, 'owner');
    insertMembership(member.id, c.id, 'member');
    const food = insertFood('Pomme');
    const entry = insertEntry(c.id, food.id, member.id);

    deleteUserAccount(member.id);
    const remaining = testDb.select().from(foodEntries).where(eq(foodEntries.id, entry.id)).all();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].loggedBy).toBeNull();
  });

  it('cascades sessions, passkeys and tip dismissals', async () => {
    const u = await insertUser('me@example.com');
    const c = insertChild('Bébé', u.id);
    insertMembership(u.id, c.id, 'owner');
    testDb
      .insert(sessions)
      .values({ id: 'sess1', userId: u.id, expiresAt: new Date(Date.now() + 100000) })
      .run();
    testDb
      .insert(passkeys)
      .values({
        id: 'pk1',
        userId: u.id,
        publicKey: 'k',
        counter: 0,
        transports: '[]',
        deviceType: 'singleDevice',
        backedUp: false,
        name: 'Téléphone',
        createdAt: new Date()
      })
      .run();
    testDb
      .insert(tipDismissals)
      .values({ userId: u.id, childId: c.id, reminderKey: 'k', dismissedAt: new Date() })
      .run();

    deleteUserAccount(u.id);

    expect(testDb.select().from(sessions).all()).toHaveLength(0);
    expect(testDb.select().from(passkeys).all()).toHaveLength(0);
    expect(testDb.select().from(tipDismissals).all()).toHaveLength(0);
  });

  it('frees the email for re-signup', async () => {
    const u = await insertUser('reuse@example.com');
    deleteUserAccount(u.id);
    const u2 = await insertUser('reuse@example.com');
    expect(u2.id).not.toBe(u.id);
  });
});

describe('exportUserData', () => {
  it('throws for unknown users', () => {
    expect(() => exportUserData(99_999)).toThrow();
  });

  it('returns the expected shape with redactions', async () => {
    const u = await insertUser('export@example.com', 'Eve');
    const c = insertChild('Léa', u.id);
    insertMembership(u.id, c.id, 'owner');
    const food = insertFood('Banane');
    insertEntry(c.id, food.id, u.id);
    testDb
      .insert(passkeys)
      .values({
        id: 'pk-export',
        userId: u.id,
        publicKey: 'SECRET-PUBLIC-KEY',
        counter: 42,
        transports: '["internal"]',
        deviceType: 'multiDevice',
        backedUp: true,
        name: 'iPhone',
        createdAt: new Date()
      })
      .run();

    const out = exportUserData(u.id);
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
    const out = exportUserData(u.id);
    expect(out.children).toEqual([]);
    expect(out.passkeys).toEqual([]);
  });

  it('returns child with empty foodEntries when nothing has been logged yet', async () => {
    const u = await insertUser('blank@example.com');
    const c = insertChild('Bébé', u.id);
    insertMembership(u.id, c.id, 'owner');
    const out = exportUserData(u.id);
    expect(out.children).toHaveLength(1);
    expect(out.children[0].foodEntries).toEqual([]);
  });

  it('marks entries logged by another member as not loggedByMe', async () => {
    const owner = await insertUser('owner@example.com');
    const member = await insertUser('member@example.com');
    const c = insertChild('Bébé', owner.id);
    insertMembership(owner.id, c.id, 'owner');
    insertMembership(member.id, c.id, 'member');
    const food = insertFood('Riz');
    insertEntry(c.id, food.id, owner.id);

    const out = exportUserData(member.id);
    expect(out.children[0].foodEntries[0].loggedByMe).toBe(false);
  });
});
