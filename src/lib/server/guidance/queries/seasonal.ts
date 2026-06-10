// Texture-coverage queries.

import { db } from '$lib/server/db';
import { foodEntries } from '$lib/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function loadTexturesTried(childId: number): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(distinct ${foodEntries.texture})` })
    .from(foodEntries)
    .where(and(eq(foodEntries.childId, childId), sql`${foodEntries.texture} IS NOT NULL`))
    .limit(1);
  /* v8 ignore next : COUNT() always returns a row */
  return rows[0]?.n ?? 0;
}
