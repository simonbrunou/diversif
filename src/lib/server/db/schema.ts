import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  uniqueIndex,
  check
} from 'drizzle-orm/sqlite-core';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';
// Relative import so drizzle-kit can load this file outside the Vite/SvelteKit
// alias resolver (npm run db:generate runs schema.ts directly via tsx).
import { TEXTURE_VALUES } from '../../utils/textures';
import { REACTION_VALUES } from '../../utils/reaction-values';
import { SYMPTOM_LABELS } from '../../content/symptoms';
import type { DietExclusion } from '../../utils/diet';

// SQLite type conventions used throughout this schema:
//   - serial PK            -> integer().primaryKey({ autoIncrement: true })
//   - timestamptz (Date)   -> integer({ mode: 'timestamp_ms' }) (Drizzle still
//                             reads/writes JS Date objects)
//   - boolean              -> integer({ mode: 'boolean' }) (stored as 0/1)
//   - jsonb                -> text({ mode: 'json' }) (stored as a JSON string)
// Foreign-key actions only fire when `PRAGMA foreign_keys = ON` is set on the
// connection — see src/lib/server/db/index.ts and src/test/db.ts.

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    tosAcceptedAt: integer('tos_accepted_at', { mode: 'timestamp_ms' }),
    privacyAcceptedAt: integer('privacy_accepted_at', { mode: 'timestamp_ms' }),
    ageConfirmedAt: integer('age_confirmed_at', { mode: 'timestamp_ms' }),
    lastLoginAt: integer('last_login_at', { mode: 'timestamp_ms' }),
    lastExportAt: integer('last_export_at', { mode: 'timestamp_ms' })
  },
  (t) => ({
    lastLoginIdx: index('users_last_login_at_idx').on(t.lastLoginAt)
  })
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => ({
    expiresIdx: index('sessions_expires_at_idx').on(t.expiresAt)
  })
);

export const children = sqliteTable('children', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  birthDate: text('birth_date').notNull(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  // Concurrency policy for co-parent edits is deliberately LAST-WRITE-WINS (two
  // co-parents almost never edit the same row in the same second). updatedAt
  // exists so a write is at least auditable / surfaceable rather than silent,
  // and so optimistic-locking can be layered on later without another schema
  // migration. Every write path sets it; backfilled to createdAt for old rows.
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  dietaryExclusions: text('dietary_exclusions', { mode: 'json' })
    .$type<DietExclusion[]>()
    .notNull()
    .default(sql`'[]'`)
});

export const memberships = sqliteTable(
  'memberships',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'member'] }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.childId] })
  })
);

export const invitations = sqliteTable(
  'invitations',
  {
    code: text('code').primaryKey(),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),
    usedBy: integer('used_by').references(() => users.id, { onDelete: 'set null' })
  },
  (t) => ({
    expiresIdx: index('invitations_expires_at_idx').on(t.expiresAt)
  })
);

export const foods = sqliteTable(
  'foods',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    category: text('category').notNull(),
    isMajorAllergen: integer('is_major_allergen', { mode: 'boolean' }).notNull().default(false),
    allergenType: text('allergen_type'),
    suggestedAgeMonths: integer('suggested_age_months').notNull(),
    notes: text('notes'),
    isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
    customForChildId: integer('custom_for_child_id').references(() => children.id, {
      onDelete: 'cascade'
    })
  },
  (t) => ({
    customForChildIdx: index('foods_custom_for_child_idx').on(t.customForChildId),
    // Built-in seeded rows (is_custom = false) must be unique by name. SQLite
    // serializes writers (one writer at a time per file), and seedFoods() uses
    // ON CONFLICT DO NOTHING inside a transaction, but this partial unique
    // index is the hard guard: it also catches operator restores, future code
    // changes, and any divergent seeder added later. Custom (per-child) rows
    // are intentionally excluded so a parent can still name a custom food after
    // a built-in entry.
    nameSeedUnique: uniqueIndex('foods_name_seed_idx')
      .on(t.name)
      .where(sql`${t.isCustom} = 0`)
  })
);

export const foodEntries = sqliteTable(
  'food_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    // Restrict : historical entries are the source-of-truth for what was
    // actually fed to the child. Deleting a catalog row out from under them
    // would silently rewrite history. Custom foods that are no longer wanted
    // should be archived/hidden, not hard-deleted.
    foodId: integer('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'restrict' }),
    givenAt: integer('given_at', { mode: 'timestamp_ms' }).notNull(),
    reaction: text('reaction', { enum: REACTION_VALUES }).notNull(),
    texture: text('texture', { enum: TEXTURE_VALUES }),
    notes: text('notes'),
    loggedBy: integer('logged_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    // Last-write-wins across co-parents (see children.updatedAt). Set on insert
    // and bumped on every edit (entry update + symptom reaction promotion).
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
    // Group token for multi-ingredient meals: NULL = standalone entry; a shared
    // UUID = ingredients logged together. Not an FK — reaction/texture/notes
    // stay on the row (reaction is per-ingredient; symptom promotion mutates one
    // row). See docs/superpowers/specs/2026-07-05-multi-ingredient-meals-design.md
    mealId: text('meal_id')
  },
  (t) => ({
    childIdx: index('food_entries_child_idx').on(t.childId, t.givenAt),
    mealIdx: index('food_entries_meal_idx').on(t.mealId),
    // A meal never contains the same food twice. Partial so standalone rows
    // (mealId NULL) can still repeat a food across days.
    mealFoodUnique: uniqueIndex('food_entries_meal_food_uq')
      .on(t.mealId, t.foodId)
      .where(sql`${t.mealId} is not null`),
    // CHECK mirrors the texture enum so the value space is enforced at the DB
    // level, not just by Drizzle's TS type.
    textureCheck: check(
      'food_entries_texture_check',
      sql`${t.texture} in ('lisse', 'moulinee', 'ecrasee', 'petits-morceaux', 'morceaux', 'finger')`
    )
  })
);

export const tipDismissals = sqliteTable(
  'tip_dismissals',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    reminderKey: text('reminder_key').notNull(),
    dismissedAt: integer('dismissed_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.childId, t.reminderKey] })
  })
);

export const passkeys = sqliteTable(
  'passkeys',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    transports: text('transports', { mode: 'json' })
      .$type<AuthenticatorTransportFuture[]>()
      .notNull()
      .default(sql`'[]'`),
    deviceType: text('device_type', { enum: ['singleDevice', 'multiDevice'] }).notNull(),
    backedUp: integer('backed_up', { mode: 'boolean' }).notNull(),
    name: text('name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' })
  },
  (t) => ({
    userIdx: index('passkeys_user_idx').on(t.userId)
  })
);

export const webauthnChallenges = sqliteTable(
  'webauthn_challenges',
  {
    token: text('token').primaryKey(),
    challenge: text('challenge').notNull(),
    purpose: text('purpose', { enum: ['registration', 'authentication'] }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => ({
    expiresIdx: index('webauthn_challenges_expires_idx').on(t.expiresAt)
  })
);

export const idempotencyKeys = sqliteTable(
  'idempotency_keys',
  {
    key: text('key').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    redirect: text('redirect'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => ({
    createdAtIdx: index('idempotency_keys_created_at_idx').on(t.createdAt)
  })
);

export const symptoms = sqliteTable(
  'symptoms',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    foodEntryId: integer('food_entry_id')
      .notNull()
      .references(() => foodEntries.id, { onDelete: 'cascade' }),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    observedAt: integer('observed_at', { mode: 'timestamp_ms' }).notNull(),
    label: text('label', { enum: SYMPTOM_LABELS }).notNull(),
    note: text('note'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' })
  },
  (t) => ({
    foodEntryIdx: index('symptoms_food_entry_id_idx').on(t.foodEntryId),
    childObservedIdx: index('symptoms_child_id_observed_at_idx').on(t.childId, t.observedAt),
    // CHECK mirrors the symptom-label enum so the value space is enforced at the
    // DB level, not just by Drizzle's TS type.
    labelCheck: check(
      'symptoms_label_check',
      sql`${t.label} in ('rougeur', 'urticaire', 'eczema', 'vomissement', 'diarrhee', 'gonflement', 'toux', 'detresse-respiratoire', 'levres-bleues', 'autre')`
    )
  })
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Child = typeof children.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type FoodEntry = typeof foodEntries.$inferSelect;
export type TipDismissal = typeof tipDismissals.$inferSelect;
export type Passkey = typeof passkeys.$inferSelect;
export type WebAuthnChallenge = typeof webauthnChallenges.$inferSelect;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;

export type NewUser = typeof users.$inferInsert;
export type NewChild = typeof children.$inferInsert;
export type NewFood = typeof foods.$inferInsert;
export type NewFoodEntry = typeof foodEntries.$inferInsert;
export type NewIdempotencyKey = typeof idempotencyKeys.$inferInsert;
export type NewPasskey = typeof passkeys.$inferInsert;
export type NewTipDismissal = typeof tipDismissals.$inferInsert;
export type NewWebAuthnChallenge = typeof webauthnChallenges.$inferInsert;
export type Symptom = typeof symptoms.$inferSelect;
export type NewSymptom = typeof symptoms.$inferInsert;
