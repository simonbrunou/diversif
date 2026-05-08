// Postgres SQLSTATE 23505 = unique_violation. node-postgres surfaces the code
// as `err.code` when the failure happens directly; drizzle/pg-mem nest it as
// `err.cause.code`. Recognise both.
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  if (code === '23505') return true;
  const cause = (err as { cause?: unknown }).cause;
  if (cause && typeof cause === 'object' && (cause as { code?: unknown }).code === '23505') {
    return true;
  }
  return false;
}
