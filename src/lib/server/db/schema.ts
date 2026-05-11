import { sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  serial,
  boolean,
  jsonb,
  timestamp,
  primaryKey,
  index,
  uniqueIndex
} from 'drizzle-orm/pg-core';
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server';

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    tosAcceptedAt: timestamp('tos_accepted_at', { withTimezone: true, mode: 'date' }),
    privacyAcceptedAt: timestamp('privacy_accepted_at', { withTimezone: true, mode: 'date' }),
    ageConfirmedAt: timestamp('age_confirmed_at', { withTimezone: true, mode: 'date' }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    lastExportAt: timestamp('last_export_at', { withTimezone: true, mode: 'date' })
  },
  (t) => ({
    lastLoginIdx: index('users_last_login_at_idx').on(t.lastLoginAt)
  })
);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (t) => ({
    expiresIdx: index('sessions_expires_at_idx').on(t.expiresAt)
  })
);

export const children = pgTable('children', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  birthDate: text('birth_date').notNull(),
  createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const memberships = pgTable(
  'memberships',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'member'] }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.childId] })
  })
);

export const invitations = pgTable(
  'invitations',
  {
    code: text('code').primaryKey(),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
    usedBy: integer('used_by').references(() => users.id, { onDelete: 'set null' })
  },
  (t) => ({
    expiresIdx: index('invitations_expires_at_idx').on(t.expiresAt)
  })
);

export const foods = pgTable(
  'foods',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    isMajorAllergen: boolean('is_major_allergen').notNull().default(false),
    allergenType: text('allergen_type'),
    suggestedAgeMonths: integer('suggested_age_months').notNull(),
    notes: text('notes'),
    isCustom: boolean('is_custom').notNull().default(false),
    customForChildId: integer('custom_for_child_id').references(() => children.id, {
      onDelete: 'cascade'
    })
  },
  (t) => ({
    customForChildIdx: index('foods_custom_for_child_idx').on(t.customForChildId),
    // Built-in seeded rows (is_custom = false) must be unique by name. The
    // advisory-locked transaction in seedFoods() serializes concurrent boots
    // and ON CONFLICT DO NOTHING absorbs race-losers, but this index is the
    // hard guard: it also catches operator pg_restore replays, future code
    // changes that bypass the lock, and any divergent seeder that might be
    // added later. Custom (per-child) rows are intentionally excluded so a
    // parent can still name a custom food after a built-in entry.
    nameSeedUnique: uniqueIndex('foods_name_seed_idx')
      .on(t.name)
      .where(sql`${t.isCustom} = false`)
  })
);

export const foodEntries = pgTable(
  'food_entries',
  {
    id: serial('id').primaryKey(),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    // Restrict — historical entries are the source-of-truth for what was
    // actually fed to the child. Deleting a catalog row out from under them
    // would silently rewrite history. Custom foods that are no longer wanted
    // should be archived/hidden, not hard-deleted.
    foodId: integer('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'restrict' }),
    givenAt: timestamp('given_at', { withTimezone: true, mode: 'date' }).notNull(),
    reaction: text('reaction', { enum: ['ras', 'inconfort', 'reaction'] }).notNull(),
    notes: text('notes'),
    loggedBy: integer('logged_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (t) => ({
    childIdx: index('food_entries_child_idx').on(t.childId, t.givenAt)
  })
);

export const tipDismissals = pgTable(
  'tip_dismissals',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    reminderKey: text('reminder_key').notNull(),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.childId, t.reminderKey] })
  })
);

export const passkeys = pgTable(
  'passkeys',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    publicKey: text('public_key').notNull(),
    counter: integer('counter').notNull().default(0),
    transports: jsonb('transports')
      .$type<AuthenticatorTransportFuture[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    deviceType: text('device_type', { enum: ['singleDevice', 'multiDevice'] }).notNull(),
    backedUp: boolean('backed_up').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' })
  },
  (t) => ({
    userIdx: index('passkeys_user_idx').on(t.userId)
  })
);

export const webauthnChallenges = pgTable(
  'webauthn_challenges',
  {
    token: text('token').primaryKey(),
    challenge: text('challenge').notNull(),
    purpose: text('purpose', { enum: ['registration', 'authentication'] }).notNull(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (t) => ({
    expiresIdx: index('webauthn_challenges_expires_idx').on(t.expiresAt)
  })
);

export const idempotencyKeys = pgTable(
  'idempotency_keys',
  {
    key: text('key').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    redirect: text('redirect'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (t) => ({
    createdAtIdx: index('idempotency_keys_created_at_idx').on(t.createdAt)
  })
);

export const symptoms = pgTable(
  'symptoms',
  {
    id: serial('id').primaryKey(),
    foodEntryId: integer('food_entry_id')
      .notNull()
      .references(() => foodEntries.id, { onDelete: 'cascade' }),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
    label: text('label').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    createdBy: integer('created_by').references(() => users.id, { onDelete: 'set null' })
  },
  (t) => ({
    foodEntryIdx: index('symptoms_food_entry_id_idx').on(t.foodEntryId),
    childObservedIdx: index('symptoms_child_id_observed_at_idx').on(t.childId, t.observedAt)
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
