// Uniform row access for hand-crafted SQL. bun:sqlite (drizzle-orm/bun-sqlite)
// is synchronous and exposes `db.all()` for raw `sql\`...\`` queries, returning
// rows as a plain array. Both prod and the test harness now run on bun:sqlite,
// so there's no longer a cross-driver result-shape mismatch to bridge — but
// callers still route through execRows() for a single typed surface and to keep
// the `await execRows(...)` call sites unchanged.
import type { SQL } from 'drizzle-orm';

type Executor = { all: (q: SQL) => unknown };

export async function execRows<T = Record<string, unknown>>(
  db: Executor,
  query: SQL
): Promise<T[]> {
  const rows = db.all(query);
  return Array.isArray(rows) ? (rows as T[]) : [];
}
