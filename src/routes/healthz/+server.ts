import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

const startedAt = Date.now();

export const GET: RequestHandler = () => {
  try {
    db.get(sql`SELECT 1 as ok`);
    return json({ ok: true, db: 'ok', uptimeMs: Date.now() - startedAt });
  } catch {
    return json({ ok: false, db: 'down' }, { status: 503 });
  }
};
