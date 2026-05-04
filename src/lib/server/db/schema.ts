import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
});

export const children = sqliteTable('children', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  birthDate: text('birth_date').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
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

export const invitations = sqliteTable('invitations', {
  code: text('code').primaryKey(),
  childId: integer('child_id')
    .notNull()
    .references(() => children.id, { onDelete: 'cascade' }),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp_ms' }),
  usedBy: integer('used_by').references(() => users.id)
});

export const foods = sqliteTable('foods', {
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
});

export const foodEntries = sqliteTable(
  'food_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    childId: integer('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    foodId: integer('food_id')
      .notNull()
      .references(() => foods.id),
    givenAt: integer('given_at', { mode: 'timestamp_ms' }).notNull(),
    reaction: text('reaction', { enum: ['ras', 'inconfort', 'reaction'] }).notNull(),
    notes: text('notes'),
    loggedBy: integer('logged_by')
      .notNull()
      .references(() => users.id),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
  },
  (t) => ({
    childIdx: index('food_entries_child_idx').on(t.childId, t.givenAt)
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
    // base64url-encoded credential ID returned by the authenticator.
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // base64url-encoded COSE public key.
    publicKey: text('public_key').notNull(),
    // Signature counter reported by the authenticator.
    counter: integer('counter').notNull().default(0),
    // JSON-encoded array of AuthenticatorTransportFuture values.
    transports: text('transports').notNull().default('[]'),
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

export const webauthnChallenges = sqliteTable('webauthn_challenges', {
  // Random opaque token stored in a short-lived cookie.
  token: text('token').primaryKey(),
  challenge: text('challenge').notNull(),
  purpose: text('purpose', { enum: ['registration', 'authentication'] }).notNull(),
  // null for usernameless authentication ceremonies.
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
});

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

export type NewUser = typeof users.$inferInsert;
export type NewChild = typeof children.$inferInsert;
export type NewFood = typeof foods.$inferInsert;
export type NewFoodEntry = typeof foodEntries.$inferInsert;
export type NewTipDismissal = typeof tipDismissals.$inferInsert;
export type NewPasskey = typeof passkeys.$inferInsert;
export type NewWebAuthnChallenge = typeof webauthnChallenges.$inferInsert;
