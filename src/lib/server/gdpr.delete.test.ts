import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';

mock.module('$lib/server/db', () => ({ db: testDb }));

const auditSpy = mock();
import * as actualAudit from './audit';
mock.module('./audit', () => ({
  ...actualAudit,
  audit: (...args: Parameters<typeof actualAudit.audit>) => auditSpy(...args)
}));

import { deleteUserAccount } from './gdpr';
import {
  children,
  foodEntries,
  memberships,
  passkeys,
  sessions,
  tipDismissals,
  users
} from './db/schema';
import { and, eq } from 'drizzle-orm';
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

  it("removes a departing member's tip dismissal via the userId FK, leaving the surviving child and the other member's dismissal untouched", async () => {
    // tipDismissals cascades on BOTH userId and childId. The child must survive
    // this deletion so the row can only vanish through the userId FK — proving
    // that cascade independently of childId's.
    const owner = await insertUser('o@example.com');
    const member = await insertUser('m@example.com');
    const c = await insertChild('Bébé', owner.id);
    await insertMembership(owner.id, c.id, 'owner');
    await insertMembership(member.id, c.id, 'member');
    await testDb.insert(tipDismissals).values([
      { userId: owner.id, childId: c.id, reminderKey: 'k', dismissedAt: new Date() },
      { userId: member.id, childId: c.id, reminderKey: 'k', dismissedAt: new Date() }
    ]);

    await deleteUserAccount(member.id);

    expect(await testDb.select().from(children)).toHaveLength(1);
    const remaining = await testDb.select().from(tipDismissals);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe(owner.id);
  });

  it('frees the email for re-signup', async () => {
    const u = await insertUser('reuse@example.com');
    await deleteUserAccount(u.id);
    const u2 = await insertUser('reuse@example.com');
    expect(u2.id).not.toBe(u.id);
  });

  it('emits an account.deleted audit event with the deletion summary', async () => {
    const owner = await insertUser('audited@example.com');
    const c = await insertChild('Bébé', owner.id);
    await insertMembership(owner.id, c.id, 'owner');

    await deleteUserAccount(owner.id);

    expect(auditSpy).toHaveBeenCalledOnce();
    expect(auditSpy).toHaveBeenCalledWith({
      type: 'account.deleted',
      userId: owner.id,
      deletedChildren: 1,
      promotedMemberships: 0,
      removedMemberships: 0
    });
  });
});
