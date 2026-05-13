import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

const startedAt = Date.now();

// Health probes must reflect the live state of this process : never the
// last cached response from a CDN or browser. Cache-Control: no-store keeps
// uptime/db status fresh for Coolify, the on-call phone curl, and any
// upstream balancer that might otherwise serve a 200 from cache after the
// process crashed.
const NO_STORE = { 'Cache-Control': 'no-store' };

export const GET: RequestHandler = async () => {
  try {
    await db.execute(sql`SELECT 1 as ok`);
    return json({ ok: true, db: 'ok', uptimeMs: Date.now() - startedAt }, { headers: NO_STORE });
  } catch {
    return json({ ok: false, db: 'down' }, { status: 503, headers: NO_STORE });
  }
};
