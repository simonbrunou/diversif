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
 *
 * For routes that surface errors through paraglide message keys (account/*,
 * signup, login), use `parseFormWithKey` instead — it returns a failure with
 * a caller-specified field name (e.g. `passwordErrorKey`) carrying a key
 * string the client resolves through `resolveMessageKey()`.
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

type ParseFormWithKeyResult<T, TField extends string, TEcho extends string> =
  | { ok: true; data: T }
  | {
      ok: false;
      failure: ActionFailure<Record<TField, string> & { [K in TEcho]?: string }>;
    };

/**
 * Like `parseForm`, but returns a failure shaped as `{ [field]: badInputKey }`
 * instead of `{ error: string }`. Suited for routes whose `+page.svelte`
 * surfaces errors through `resolveMessageKey()` (account/*, signup, login).
 *
 * When `echo` is provided, those named form fields are coerced to strings and
 * spread into the failure payload as top-level keys so the page can re-bind
 * them (e.g. `value={form?.email}`). Password / secret fields should never
 * be echoed.
 *
 * Usage:
 *   const parsed = await parseFormWithKey(request, loginSchema, {
 *     field: 'errorKey',
 *     badInputKey: 'errorsAuthBadInput',
 *     echo: ['email']
 *   });
 *   if (!parsed.ok) return parsed.failure;
 */
export async function parseFormWithKey<T, TField extends string, TEcho extends string = never>(
  request: Request,
  schema: ZodSchema<T>,
  opts: { field: TField; badInputKey: string; echo?: readonly TEcho[] }
): Promise<ParseFormWithKeyResult<T, TField, TEcho>> {
  const formData = await request.formData();
  const values = Object.fromEntries(formData);
  const result = schema.safeParse(values);
  if (!result.success) {
    const echoed: Record<string, string> = {};
    if (opts.echo) {
      for (const name of opts.echo) {
        const v = values[name];
        if (v !== undefined) echoed[name] = typeof v === 'string' ? v : v.name;
      }
    }
    return {
      ok: false,
      failure: fail(400, { [opts.field]: opts.badInputKey, ...echoed } as Record<TField, string> & {
        [K in TEcho]?: string;
      })
    };
  }
  return { ok: true, data: result.data };
}
