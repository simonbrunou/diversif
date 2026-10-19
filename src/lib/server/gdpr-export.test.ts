import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../test/db';
import {
  ExportTooLargeError,
  OPERATOR_EXPORT,
  UserNotFoundError,
  exportUserData,
  type ExportOptions
} from './gdpr-export';
import {
  children,
  foodEntries,
  invitations,
  passkeys,
  preparedMeals,
  symptoms,
  tipDismissals,
  users
} from './db/schema';
import {
  insertChild,
  insertEntry,
  insertFood,
  insertMembership,
  insertUser
} from './gdpr-test-fixtures';

// The module takes the database as a parameter, so tests hand it the
// in-memory testDb directly: no mock.module of the db singleton or of audit.
// Payload tests route the audit trail into a spy, which keeps stdout clean and
// lets the audit tests assert on the events.
const auditSpy = mock();

function exportFor(userId: number, options: ExportOptions = {}) {
  return exportUserData(testDb, { userId }, { audit: auditSpy, ...options });
}

// One child owned by a fresh user, with `count` food entries bulk-inserted in
// one statement (a recursive CTE): fast enough to cross the real 50 000-row
// cap without 50k round trips.
async function userWithEntries(count: number) {
  const u = await insertUser('bulk@example.com');
  const c = await insertChild('Bébé', u.id);
  await insertMembership(u.id, c.id, 'owner');
  const food = await insertFood('Riz');
  testDb.run(sql`
    WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${count})
    INSERT INTO food_entries (child_id, food_id, given_at, reaction, logged_by, created_at)
    SELECT ${c.id}, ${food.id}, 1700000000000 + i, 'ras', ${u.id}, 1700000000000 FROM n`);
  return u;
}

beforeEach(async () => {
  await resetTestDb();
  auditSpy.mockClear();
});

describe('exportUserData: subject lookup', () => {
  it('throws UserNotFoundError for an unknown user id', async () => {
    await expect(exportFor(99_999)).rejects.toThrow(UserNotFoundError);
  });

  it('throws UserNotFoundError for an unknown email', async () => {
    await expect(
      exportUserData(testDb, { email: 'nobody@example.com' }, OPERATOR_EXPORT)
    ).rejects.toThrow(UserNotFoundError);
  });

  it('finds the subject by email, case-insensitively, with the same payload as by id', async () => {
    const u = await insertUser('mixed@example.com', 'Mia');
    const c = await insertChild('Léa', u.id);
    await insertMembership(u.id, c.id, 'owner');
    await insertEntry(c.id, (await insertFood('Banane')).id, u.id);

    const { exportedAt: _byEmailAt, ...byEmail } = await exportUserData(
      testDb,
      { email: 'MIXED@Example.com' },
      OPERATOR_EXPORT
    );
    const { exportedAt: _byIdAt, ...byId } = await exportUserData(
      testDb,
      { userId: u.id },
      OPERATOR_EXPORT
    );

    expect(byEmail.profile.id).toBe(u.id);
    expect(byEmail).toEqual(byId);
  });
});

describe('exportUserData: payload', () => {
  it('returns the expected shape with redactions', async () => {
    const u = await insertUser('export@example.com', 'Eve');
    const c = await insertChild('Léa', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const food = await insertFood('Banane');
    await insertEntry(c.id, food.id, u.id);
    await testDb.insert(preparedMeals).values({
      childId: c.id,
      brand: 'Yooji',
      name: 'Banane bio',
      ingredientFoodIds: [food.id],
      createdAt: new Date('2026-03-01T00:00:00Z'),
      updatedAt: new Date('2026-03-01T00:00:00Z')
    });
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

    const out = await exportFor(u.id);
    expect(out.generator).toBe('diversif');
    expect(out.schemaVersion).toBe(1);
    expect(out.profile.email).toBe('export@example.com');
    expect(out.profile.displayName).toBe('Eve');
    expect(out.profile.lastExportAt).toBe('2026-04-01T00:00:00.000Z');
    expect(out.children).toHaveLength(1);
    expect(out.children[0].name).toBe('Léa');
    expect(out.children[0].dietaryExclusions).toEqual([]); // column default
    expect(out.children[0].membership.role).toBe('owner');
    expect(out.children[0].foodEntries).toHaveLength(1);
    expect(out.children[0].foodEntries[0].foodName).toBe('Banane');
    expect(out.children[0].foodEntries[0].loggedByMe).toBe(true);
    expect(out.children[0].preparedMeals).toEqual([
      expect.objectContaining({
        brand: 'Yooji',
        name: 'Banane bio',
        ingredients: [{ foodId: food.id, foodName: 'Banane' }]
      })
    ]);
    expect(out.passkeys).toHaveLength(1);
    expect(out.passkeys[0].id).toBe('pk-export');
    // Public key, counter and password hash must NOT be in the export.
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('SECRET-PUBLIC-KEY');
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('counter');
  });

  it('keeps prepared-meal ingredients readable after the related log is deleted', async () => {
    const u = await insertUser('preset-export@example.com');
    const c = await insertChild('Léa', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const food = await insertFood('Carotte');
    await insertEntry(c.id, food.id, u.id);
    await testDb.insert(preparedMeals).values({
      childId: c.id,
      brand: 'Babybio',
      name: 'Carottes',
      ingredientFoodIds: [food.id],
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await testDb.delete(foodEntries).where(eq(foodEntries.childId, c.id));

    const out = await exportFor(u.id);
    expect(out.children[0].foodEntries).toEqual([]);
    expect(out.children[0].preparedMeals[0].ingredients).toEqual([
      { foodId: food.id, foodName: 'Carotte' }
    ]);
  });

  it("includes the child's dietaryExclusions (RGPD art. 15/20 completeness)", async () => {
    const u = await insertUser('diet-export@example.com');
    const c = await insertChild('Léa', u.id);
    await insertMembership(u.id, c.id, 'owner');
    await testDb
      .update(children)
      .set({ dietaryExclusions: ['vegetarien', 'porc'] })
      .where(eq(children.id, c.id));

    const out = await exportFor(u.id);
    expect(out.children[0].dietaryExclusions).toEqual(['vegetarien', 'porc']);
  });

  it('drops dietaryExclusions ids outside the known set instead of failing', async () => {
    const u = await insertUser('diet-unknown@example.com');
    const c = await insertChild('Léa', u.id);
    await insertMembership(u.id, c.id, 'owner');
    // Raw write: the typed column would refuse an unknown id.
    testDb.run(
      sql`UPDATE children SET dietary_exclusions = ${JSON.stringify(['porc', 'inconnu'])} WHERE id = ${c.id}`
    );

    const out = await exportFor(u.id);
    expect(out.children[0].dietaryExclusions).toEqual(['porc']);
  });

  it('lists children by id with their own membership, whatever order the user joined them in', async () => {
    const u = await insertUser('two-kids@example.com');
    const owner = await insertUser('other-parent@example.com');
    const first = await insertChild('Aïcha', owner.id);
    const second = await insertChild('Basile', u.id);
    await insertMembership(u.id, second.id, 'owner', new Date('2026-01-01T00:00:00Z'));
    await insertMembership(owner.id, first.id, 'owner');
    await insertMembership(u.id, first.id, 'member', new Date('2026-02-01T00:00:00Z'));

    const out = await exportFor(u.id);
    expect(out.children.map((c) => [c.name, c.membership])).toEqual([
      ['Aïcha', { role: 'member', joinedAt: '2026-02-01T00:00:00.000Z' }],
      ['Basile', { role: 'owner', joinedAt: '2026-01-01T00:00:00.000Z' }]
    ]);
  });

  it('returns empty children list when user has no memberships', async () => {
    const u = await insertUser('alone@example.com');
    const out = await exportFor(u.id);
    expect(out.children).toEqual([]);
    expect(out.passkeys).toEqual([]);
  });

  it('returns child with empty foodEntries when nothing has been logged yet', async () => {
    const u = await insertUser('blank@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const out = await exportFor(u.id);
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

    const senderOut = await exportFor(inviter.id);
    expect(senderOut.invitations).toHaveLength(2);
    // Ordered by createdAt: INV-SENT first (2026-05-01), INV-ACCEPTED second
    // (2026-05-02). Identify by usedAt rather than code (code is intentionally
    // absent from the export : see ExportedUser.invitations docstring).
    expect(senderOut.invitations[0]).toMatchObject({ relationship: 'sent', usedAt: null });
    expect(senderOut.invitations[1].relationship).toBe('sent');
    expect(senderOut.invitations[1].usedAt).not.toBeNull();

    const accepterOut = await exportFor(accepted.id);
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

    const out = await exportFor(user.id);

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

    const out = await exportFor(u.id);
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

    const out = await exportFor(member.id);
    expect(out.children[0].foodEntries[0].loggedByMe).toBe(false);
  });

  it('includes texture in exported food entries', async () => {
    const u = await insertUser('texture-export@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const food = await insertFood('Patate douce');
    await insertEntry(c.id, food.id, u.id, 'ecrasee');
    await insertEntry(c.id, food.id, u.id, null);

    const out = await exportFor(u.id);
    const entries = out.children[0].foodEntries;
    expect(entries).toHaveLength(2);
    expect(entries[0].texture).toBe('ecrasee');
    expect(entries[1].texture).toBeNull();
  });

  it('includes mealId, shared by the ingredients of one meal and null on a standalone entry', async () => {
    const u = await insertUser('meal-export@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const carotte = await insertFood('Carotte');
    const poulet = await insertFood('Poulet');
    const mealId = randomUUID();
    const givenAt = new Date('2026-05-02T08:00:00Z');
    await testDb.insert(foodEntries).values(
      [carotte, poulet].map((food) => ({
        childId: c.id,
        foodId: food.id,
        givenAt,
        reaction: 'ras' as const,
        loggedBy: u.id,
        mealId,
        createdAt: givenAt
      }))
    );
    await testDb.insert(foodEntries).values({
      childId: c.id,
      foodId: carotte.id,
      givenAt: new Date('2026-05-03T08:00:00Z'),
      reaction: 'ras',
      loggedBy: u.id,
      createdAt: givenAt
    });

    const out = await exportFor(u.id);
    expect(out.children[0].foodEntries.map((e) => [e.foodName, e.mealId])).toEqual([
      ['Carotte', mealId],
      ['Poulet', mealId],
      ['Carotte', null]
    ]);
  });

  it('nests symptoms under the right food entry with recordedByMe, excluding unrelated children', async () => {
    const owner = await insertUser('symptom-owner@example.com');
    const coParent = await insertUser('symptom-coparent@example.com');
    const stranger = await insertUser('symptom-stranger@example.com');
    const child = await insertChild('Léa', owner.id);
    await insertMembership(owner.id, child.id, 'owner');
    await insertMembership(coParent.id, child.id, 'member');
    const food = await insertFood('Oeuf');
    const entryWithSymptoms = await insertEntry(child.id, food.id, owner.id);
    const entryWithoutSymptoms = await insertEntry(child.id, food.id, owner.id);

    // A child the exporting user has no membership on at all : its symptoms
    // must never surface in owner's export, even though the query scopes by
    // childId rather than by owner's foodEntry ids.
    const strangerChild = await insertChild('Théo', stranger.id);
    await insertMembership(stranger.id, strangerChild.id, 'owner');
    const strangerEntry = await insertEntry(strangerChild.id, food.id, stranger.id);
    await testDb.insert(symptoms).values({
      foodEntryId: strangerEntry.id,
      childId: strangerChild.id,
      observedAt: new Date(),
      label: 'eczema',
      note: null,
      createdBy: stranger.id,
      createdAt: new Date()
    });

    await testDb.insert(symptoms).values({
      foodEntryId: entryWithSymptoms.id,
      childId: child.id,
      observedAt: new Date('2026-05-01T10:00:00Z'),
      label: 'urticaire',
      note: 'Rougeurs au visage',
      createdBy: owner.id,
      createdAt: new Date('2026-05-01T10:05:00Z')
    });
    await testDb.insert(symptoms).values({
      foodEntryId: entryWithSymptoms.id,
      childId: child.id,
      observedAt: new Date('2026-05-01T10:10:00Z'),
      label: 'vomissement',
      note: null,
      createdBy: coParent.id,
      createdAt: new Date('2026-05-01T10:15:00Z')
    });

    const out = await exportFor(owner.id);
    expect(out.children).toHaveLength(1); // strangerChild never appears
    const entries = out.children[0].foodEntries;
    const withSymptoms = entries.find((e) => e.id === entryWithSymptoms.id)!;
    const withoutSymptoms = entries.find((e) => e.id === entryWithoutSymptoms.id)!;
    expect(withSymptoms.symptoms).toEqual([
      {
        id: expect.any(Number),
        observedAt: '2026-05-01T10:00:00.000Z',
        label: 'urticaire',
        note: 'Rougeurs au visage',
        recordedByMe: true,
        createdAt: '2026-05-01T10:05:00.000Z'
      },
      {
        id: expect.any(Number),
        observedAt: '2026-05-01T10:10:00.000Z',
        label: 'vomissement',
        note: null,
        recordedByMe: false,
        createdAt: '2026-05-01T10:15:00.000Z'
      }
    ]);
    expect(withoutSymptoms.symptoms).toEqual([]);
  });
});

describe('exportUserData: row cap and audit trail', () => {
  it('throws ExportTooLargeError when food entries exceed the cap', async () => {
    const u = await userWithEntries(3);
    const err = await exportFor(u.id, { rowLimit: 2 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExportTooLargeError);
    expect(err).toMatchObject({ count: 3, limit: 2 });
  });

  it('throws ExportTooLargeError when entries are within the cap but symptoms push the combined total over it', async () => {
    const u = await insertUser('symptom-heavy@example.com');
    const c = await insertChild('Bébé', u.id);
    await insertMembership(u.id, c.id, 'owner');
    const food = await insertFood('Riz');
    // 2 entries, well under a cap of 5 — but 4 symptoms on top push the
    // combined food-entry + symptom count to 6, over the cap. Guards against
    // the preflight counting only food_entries and missing an unbounded
    // symptom log.
    const entry1 = await insertEntry(c.id, food.id, u.id);
    const entry2 = await insertEntry(c.id, food.id, u.id);
    for (let i = 0; i < 4; i++) {
      await testDb.insert(symptoms).values({
        foodEntryId: i % 2 === 0 ? entry1.id : entry2.id,
        childId: c.id,
        observedAt: new Date(),
        label: 'rougeur',
        note: null,
        createdBy: u.id,
        createdAt: new Date()
      });
    }

    const err = await exportFor(u.id, { rowLimit: 5 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExportTooLargeError);
    expect(err).toMatchObject({ count: 6, limit: 5 });
  });

  it('exports normally when entry count equals the cap', async () => {
    const u = await userWithEntries(2);
    const out = await exportFor(u.id, { rowLimit: 2 });
    expect(out.children[0].foodEntries).toHaveLength(2);
  });

  it('emits an account.export_blocked audit event when the cap trips', async () => {
    const u = await userWithEntries(2);

    await expect(exportFor(u.id, { rowLimit: 1 })).rejects.toThrow(ExportTooLargeError);

    expect(auditSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledWith({
      type: 'account.export_blocked',
      userId: u.id,
      reason: 'too_large',
      count: 2,
      limit: 1
    });
  });

  it('emits an account.exported audit event with the entry count', async () => {
    const u = await userWithEntries(3);

    await exportFor(u.id);

    expect(auditSpy).toHaveBeenCalledTimes(1);
    expect(auditSpy).toHaveBeenCalledWith({
      type: 'account.exported',
      userId: u.id,
      foodEntryCount: 3
    });
  });
});

describe('exportUserData: default options vs OPERATOR_EXPORT', () => {
  let logSpy: ReturnType<typeof spyOn<Console, 'log'>>;
  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    logSpy.mockRestore();
  });

  it('defaults to the self-service policy: 50 000-row cap, refusal written to the audit log', async () => {
    const u = await userWithEntries(50_001);

    const err = await exportUserData(testDb, { userId: u.id }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ExportTooLargeError);
    expect(err).toMatchObject({ count: 50_001, limit: 50_000 });
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({
      level: 'audit',
      type: 'account.export_blocked',
      userId: u.id
    });
  });

  it('writes account.exported to the audit log by default', async () => {
    const u = await userWithEntries(1);

    await exportUserData(testDb, { userId: u.id });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(logSpy.mock.calls[0][0] as string)).toMatchObject({
      level: 'audit',
      type: 'account.exported',
      userId: u.id,
      foodEntryCount: 1
    });
  });

  it('OPERATOR_EXPORT exports past the self-service cap and writes nothing to stdout', async () => {
    const u = await userWithEntries(50_001);

    const out = await exportUserData(testDb, { userId: u.id }, OPERATOR_EXPORT);

    expect(out.children[0].foodEntries).toHaveLength(50_001);
    // The operator script prints the export on stdout, where audit() also
    // writes: a single audit line would corrupt the JSON it hands over.
    expect(logSpy).not.toHaveBeenCalled();
  });
});
