import type { ZodSchema } from 'zod';
import { fail, type ActionFailure } from '@sveltejs/kit';

type ParseFormResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      failure: ActionFailure<{ error: string; values?: Record<string, FormDataEntryValue> }>;
    };

/**
 * Parse a form request against a zod schema. Returns a discriminated result
 * so consumers can do `if (!parsed.ok) return parsed.failure`.
 *
 * Usage:
 *   const parsed = await parseForm(request, schema);
 *   if (!parsed.ok) return parsed.failure;
 *   // parsed.data is fully typed
 */
export async function parseForm<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<ParseFormResult<T>> {
  const formData = await request.formData();
  const values = Object.fromEntries(formData);
  const result = schema.safeParse(values);
  if (!result.success) {
    // zod guarantees at least one issue when success is false.
    return {
      ok: false,
      failure: fail(400, { error: result.error.issues[0].message, values })
    };
  }
  return { ok: true, data: result.data };
}
