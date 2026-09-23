import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { children } from '$lib/server/db/schema';
import { mealDateError, type MealDateErrorKey } from '$lib/utils/meal-date';

// Cheap, childId-scoped bounds check for a meal's givenAt: selects only the
// birth date column (requireChildContext doesn't carry it, and none of the
// three write paths — create, single-entry update, whole-meal update — call
// the child layout's load) and delegates to mealDateError. Shared here
// instead of copy-pasted per route, so every write path agrees on the same
// select and the same "now".
export async function mealDateErrorForChild(
  childId: number,
  givenAt: Date
): Promise<MealDateErrorKey | null> {
  const row = (
    await db
      .select({ birthDate: children.birthDate })
      .from(children)
      .where(eq(children.id, childId))
  )[0];
  return row ? mealDateError(givenAt, row.birthDate, Date.now()) : null;
}
