// Pins output parity between the self-service export (exportUserData, used by
// /account/export) and the operator-side script (scripts/export-user.ts),
// which is a standalone raw-SQL re-implementation kept separate because the
// runtime Docker image ships scripts/ without the rest of src/ (see the
// script's own header comment). Each new field landing in one but not the
// other is exactly how they drifted before (issue #369) — this test snapshots
// the SAME database both read from and fails the moment their JSON payloads
// (modulo `exportedAt`) diverge.
import { describe, expect, it, mock } from 'bun:test';
import { unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { testDb, resetTestDb } from '../../test/db';

mock.module('$lib/server/db', () => ({ db: testDb }));

import { exportUserData } from './gdpr';
import {
  children,
  foodEntries,
  foods,
  invitations,
  passkeys,
  preparedMeals,
  symptoms,
  tipDismissals,
  users
} from './db/schema';
import { DIET_EXCLUSIONS } from '$lib/utils/diet';
import {
  insertChild,
  insertEntry,
  insertFood,
  insertMembership,
  insertUser
} from './gdpr-test-fixtures';

describe('scripts/export-user.ts parity with exportUserData', () => {
  it('produces the exact same payload (modulo exportedAt) on a rich fixture', async () => {
    await resetTestDb();

    const owner = await insertUser('parity-owner@example.com', 'Owner');
    const coParent = await insertUser('parity-coparent@example.com', 'Co-parent');
    const child = await insertChild('Léa', owner.id);
    await insertMembership(owner.id, child.id, 'owner');
    await insertMembership(coParent.id, child.id, 'member');
    await testDb
      .update(children)
      .set({ dietaryExclusions: [...DIET_EXCLUSIONS] })
      .where(eq(children.id, child.id));
    await testDb
      .update(users)
      .set({ lastExportAt: new Date('2026-04-15T00:00:00Z') })
      .where(eq(users.id, owner.id));

    // Standalone entry, symptom recorded by the exporting user AND by the
    // co-parent — covers recordedByMe true/false and nesting.
    const standaloneFood = await insertFood('Oeuf');
    const standaloneEntry = await insertEntry(child.id, standaloneFood.id, owner.id, 'ecrasee');
    await testDb.insert(symptoms).values({
      foodEntryId: standaloneEntry.id,
      childId: child.id,
      observedAt: new Date('2026-05-01T10:00:00Z'),
      label: 'urticaire',
      note: 'Rougeurs au visage',
      createdBy: owner.id,
      createdAt: new Date('2026-05-01T10:05:00Z')
    });
    await testDb.insert(symptoms).values({
      foodEntryId: standaloneEntry.id,
      childId: child.id,
      observedAt: new Date('2026-05-01T10:10:00Z'),
      label: 'vomissement',
      note: null,
      createdBy: coParent.id,
      createdAt: new Date('2026-05-01T10:15:00Z')
    });

    // Multi-ingredient meal: two entries sharing a mealId, with texture set.
    const mealFoodA = await insertFood('Carotte');
    const mealFoodB = await insertFood('Panais');
    const mealId = 'meal-parity-1';
    await testDb.insert(foodEntries).values([
      {
        childId: child.id,
        foodId: mealFoodA.id,
        givenAt: new Date('2026-05-02T08:00:00Z'),
        reaction: 'ras',
        texture: 'moulinee',
        loggedBy: owner.id,
        mealId,
        createdAt: new Date('2026-05-02T08:00:00Z')
      },
      {
        childId: child.id,
        foodId: mealFoodB.id,
        givenAt: new Date('2026-05-02T08:00:00Z'),
        reaction: 'ras',
        texture: 'moulinee',
        loggedBy: coParent.id,
        mealId,
        createdAt: new Date('2026-05-02T08:00:00Z')
      }
    ]);

    // Custom food (per-child), also standalone-logged.
    const customFood = (
      await testDb
        .insert(foods)
        .values({
          name: 'Compote maison',
          category: 'fruit',
          isMajorAllergen: false,
          suggestedAgeMonths: 8,
          isCustom: true,
          customForChildId: child.id
        })
        .returning()
    )[0];
    await insertEntry(child.id, customFood.id, owner.id);

    await testDb.insert(preparedMeals).values({
      childId: child.id,
      brand: 'Babybio',
      name: 'Carottes',
      ingredientFoodIds: [mealFoodA.id],
      createdAt: new Date('2026-05-03T00:00:00Z'),
      updatedAt: new Date('2026-05-03T00:00:00Z')
    });

    await testDb.insert(passkeys).values({
      id: 'pk-parity',
      userId: owner.id,
      publicKey: 'SECRET-PUBLIC-KEY',
      counter: 3,
      transports: ['internal', 'hybrid'],
      deviceType: 'multiDevice',
      backedUp: true,
      name: 'iPhone parity',
      createdAt: new Date('2026-05-04T00:00:00Z')
    });

    // Sent invitation (unused) and accepted invitation (created by the
    // co-parent, accepted by the owner) : one of each relationship.
    await testDb.insert(invitations).values({
      code: 'INV-PARITY-SENT',
      childId: child.id,
      createdBy: owner.id,
      createdAt: new Date('2026-05-05T00:00:00Z'),
      expiresAt: new Date('2026-05-12T00:00:00Z'),
      usedAt: null,
      usedBy: null
    });
    await testDb.insert(invitations).values({
      code: 'INV-PARITY-ACCEPTED',
      childId: child.id,
      createdBy: coParent.id,
      createdAt: new Date('2026-05-06T00:00:00Z'),
      expiresAt: new Date('2026-05-13T00:00:00Z'),
      usedAt: new Date('2026-05-07T00:00:00Z'),
      usedBy: owner.id
    });

    await testDb.insert(tipDismissals).values({
      userId: owner.id,
      childId: child.id,
      reminderKey: 'priority-allergens',
      dismissedAt: new Date('2026-05-08T00:00:00Z')
    });

    const expected = await exportUserData(owner.id);

    // Can't pass vacuously on two equally-empty symptom arrays.
    expect(expected.children[0].foodEntries.some((e) => e.symptoms.length > 0)).toBe(true);

    const snapshotPath = path.join(tmpdir(), `diversif-export-parity-${Date.now()}-${owner.id}.db`);
    try {
      // VACUUM INTO can't run inside a transaction ; testDb.$client is the raw
      // bun:sqlite handle drizzle wraps (not exposed by the drizzle query
      // builder itself).
      testDb.$client.query('VACUUM INTO ?').run(snapshotPath);

      const proc = Bun.spawnSync({
        cmd: ['bun', 'scripts/export-user.ts', '--id', String(owner.id)],
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_PATH: snapshotPath },
        stdout: 'pipe',
        stderr: 'pipe'
      });
      const stderr = proc.stderr?.toString() ?? '';
      if (proc.exitCode !== 0) {
        throw new Error(`scripts/export-user.ts exited ${proc.exitCode}: ${stderr}`);
      }

      const scriptOutput = JSON.parse(proc.stdout?.toString() ?? '');
      expect(
        scriptOutput.children[0].foodEntries.some(
          (e: { symptoms: unknown[] }) => e.symptoms.length > 0
        )
      ).toBe(true);

      const expectedForCompare: Record<string, unknown> = { ...expected };
      delete expectedForCompare.exportedAt;
      delete scriptOutput.exportedAt;
      expect(scriptOutput).toEqual(expectedForCompare);
    } finally {
      try {
        unlinkSync(snapshotPath);
      } catch {
        // best-effort cleanup
      }
    }
  });
});
