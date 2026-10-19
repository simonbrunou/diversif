import type { ActionResult } from '$app/forms';
import { parse } from 'devalue';

// How a repas form reaches its SvelteKit action, shared by the online submit
// (submit.ts) and the queue's replay (queue.ts): one serialization of the
// form, one request shape, one reading of the answer.

/**
 * The transport port, in fetch's own shape. Production passes `fetch`; tests
 * pass src/test/log-action-transport.ts, which runs the real log action in
 * process and answers with SvelteKit's envelope.
 */
export type Transport = (url: string, init: RequestInit) => Promise<Response>;

export const fetchTransport: Transport = (url, init) => fetch(url, init);

/**
 * A form's fields as a queued row stores them. A key the form repeats (a
 * meal's `foodId`, one per aliment) becomes an array: last-wins capture
 * (Object.fromEntries, formData.forEach) would keep only the last aliment.
 */
export type Fields = Record<string, string | string[]>;

export function fieldsOf(form: FormData): Fields {
  const fields: Fields = {};
  for (const key of new Set(form.keys())) {
    const values = form.getAll(key).filter((v): v is string => typeof v === 'string');
    fields[key] = values.length > 1 ? values : values[0];
  }
  return fields;
}

function bodyOf(fields: Fields): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    for (const v of Array.isArray(value) ? value : [value]) body.append(key, v);
  }
  return body;
}

/**
 * What came back: the action's result, or 'unreachable' when the app itself
 * didn't answer. Either the request threw (offline, DNS, timeout) or
 * something in between answered with a page that isn't an action result: a
 * captive portal, or the proxy's error page while a deploy swaps the
 * container. use:enhance turned both into a status-less error.
 */
export type Answer = ActionResult | 'unreachable';

const RESULT_TYPES = new Set(['success', 'failure', 'redirect', 'error']);

/** POST `fields` to a SvelteKit action the way `use:enhance` does. */
export async function postAction(
  transport: Transport,
  url: string,
  fields: Fields
): Promise<Answer> {
  let response: Response;
  try {
    response = await transport(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
        'x-sveltekit-action': 'true'
      },
      cache: 'no-store',
      body: bodyOf(fields)
    });
  } catch {
    return 'unreachable';
  }
  return readResult(response);
}

async function readResult(response: Response): Promise<Answer> {
  try {
    const result = JSON.parse(await response.text());
    if (!RESULT_TYPES.has(result?.type)) return 'unreachable';
    // As $app/forms' deserialize does: `data` is devalue-encoded. devalue's
    // own parse matches it while src/hooks.ts declares no transport hooks.
    if (result.data) result.data = parse(result.data);
    // As use:enhance does: an error's status rides on the response only,
    // never in the body hooks.server.ts's handleError shapes.
    if (result.type === 'error' || result.type === 'failure') result.status = response.status;
    return result as ActionResult;
  } catch {
    return 'unreachable';
  }
}
