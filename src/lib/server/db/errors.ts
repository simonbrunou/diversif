// SQLite reports a unique-constraint failure as SQLITE_CONSTRAINT_UNIQUE
// (bun:sqlite sets `err.code`) with a message like
// "UNIQUE constraint failed: <table>.<column>". Drizzle wraps driver errors
// but preserves the original on `.cause`, so check both levels. The legacy
// Postgres SQLSTATE 23505 code is still recognised so any fixture or
// not-yet-migrated caller keeps resolving correctly.
export function isUniqueViolation(err: unknown): boolean {
  if (hasUniqueShape(err)) return true;
  const cause = (err as { cause?: unknown } | null | undefined)?.cause;
  return hasUniqueShape(cause);
}

function hasUniqueShape(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  if (code === 'SQLITE_CONSTRAINT_UNIQUE' || code === '23505') return true;
  const message = (err as { message?: unknown }).message;
  return typeof message === 'string' && message.includes('UNIQUE constraint failed');
}
