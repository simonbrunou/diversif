import { error } from '@sveltejs/kit';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { ExportTooLargeError, exportUserData } from '$lib/server/gdpr';
import { requireUser } from '$lib/server/guards';
import * as m from '$lib/paraglide/messages';
import type { RequestHandler } from './$types';

const EXPORT_THROTTLE_MS = 60_000;

export const GET: RequestHandler = async ({ locals }) => {
  const user = requireUser(locals);
  const now = Date.now();

  // Atomic check-and-set: only one concurrent request can flip lastExportAt
  // past the throttle window because the WHERE clause requires the prior
  // value to be older than now - throttle (or NULL). If `rowCount === 0`,
  // another request beat us to it.
  const claimed = await db
    .update(users)
    .set({ lastExportAt: new Date(now) })
    .where(
      and(
        eq(users.id, user.id),
        or(isNull(users.lastExportAt), lt(users.lastExportAt, new Date(now - EXPORT_THROTTLE_MS)))
      )
    )
    .returning({ id: users.id });

  if (claimed.length === 0) {
    // This is a direct top-level link navigation (not a fetch), so SvelteKit
    // renders +error.svelte with this message verbatim — resolve it here
    // (paraglide's per-request locale context) same as join/[code].
    throw error(429, m.errorsAccountExportRateLimited());
  }

  let payload;
  try {
    payload = await exportUserData(user.id);
  } catch (err) {
    // Refuse rather than silently truncate: an article 15 export is supposed
    // to be complete. If the dataset is unrealistically large we tell the
    // user explicitly so they can ask for a manual export.
    if (err instanceof ExportTooLargeError) {
      throw error(413, m.errorsAccountExportTooLarge());
    }
    throw err;
  }

  const date = new Date(now).toISOString().slice(0, 10);
  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="diversif-export-${user.id}-${date}.json"`,
      'cache-control': 'no-store'
    }
  });
};
