import { testDb } from '../../test/db';
import { children, foodEntries, foods, memberships, users } from './db/schema';
import type { TextureKey } from '$lib/utils/textures';

export async function insertUser(email: string, displayName = email) {
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

export async function insertChild(name: string, createdBy: number) {
  return (
    await testDb
      .insert(children)
      .values({ name, birthDate: '2024-01-01', createdBy, createdAt: new Date() })
      .returning()
  )[0];
}

export async function insertMembership(
  userId: number,
  childId: number,
  role: 'owner' | 'member',
  createdAt = new Date()
) {
  await testDb.insert(memberships).values({ userId, childId, role, createdAt });
}

export async function insertFood(name: string, category = 'fruit') {
  return (
    await testDb
      .insert(foods)
      .values({ name, category, isMajorAllergen: false, suggestedAgeMonths: 6 })
      .returning()
  )[0];
}

export async function insertEntry(
  childId: number,
  foodId: number,
  loggedBy: number,
  texture?: TextureKey | null
) {
  return (
    await testDb
      .insert(foodEntries)
      .values({
        childId,
        foodId,
        givenAt: new Date(),
        reaction: 'ras',
        loggedBy,
        texture: texture ?? null,
        createdAt: new Date()
      })
      .returning()
  )[0];
}
