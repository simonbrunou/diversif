// Bridge for the result-shape mismatch between bun:sql (production) and PGlite
// (tests). drizzle-orm/bun-sql's session returns rows as a plain array; drizzle-
// orm/pglite returns the node-postgres-shaped `{ rows, affectedRows, fields }`.
// Code that hand-crafts SQL via `db.execute(sql\`...\`)` is the only surface that
// sees the difference (Drizzle's typed builders normalise across drivers), so
// callers there route through execRows() and get a uniform `T[]` regardless.

import type { SQL } from 'drizzle-orm';

type Executor = { execute: (q: SQL) => Promise<unknown> };

export async function execRows<T = Record<string, unknown>>(
  db: Executor,
  query: SQL
): Promise<T[]> {
  const result = await db.execute(query);
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    const wrapped = (result as { rows?: unknown }).rows;
    return Array.isArray(wrapped) ? (wrapped as T[]) : [];
  }
  return [];
}
