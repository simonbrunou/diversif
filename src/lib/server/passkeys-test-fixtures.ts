import { testDb } from '../../test/db';
import { passkeys, users } from './db/schema';

export async function seedUser() {
  return (
    await testDb
      .insert(users)
      .values({
        email: 'parent@example.com',
        passwordHash: 'h',
        displayName: 'Parent',
        createdAt: new Date()
      })
      .returning()
  )[0];
}

export async function seedPasskey(
  userId: number,
  overrides: Partial<typeof passkeys.$inferInsert> = {}
) {
  return (
    await testDb
      .insert(passkeys)
      .values({
        id: overrides.id ?? 'cred-id',
        userId,
        publicKey: overrides.publicKey ?? 'cHVi', // base64url for "pub"
        counter: overrides.counter ?? 0,
        transports: overrides.transports ?? ['internal'],
        deviceType: overrides.deviceType ?? 'singleDevice',
        backedUp: overrides.backedUp ?? false,
        name: overrides.name ?? 'Test Key',
        createdAt: overrides.createdAt ?? new Date(),
        lastUsedAt: overrides.lastUsedAt ?? null
      })
      .returning()
  )[0];
}
