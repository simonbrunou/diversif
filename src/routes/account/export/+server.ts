import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { exportUserData } from '$lib/server/gdpr';
import { requireUser } from '$lib/server/guards';
import type { RequestHandler } from './$types';

const EXPORT_THROTTLE_MS = 60_000;

export const GET: RequestHandler = ({ locals }) => {
  const user = requireUser(locals);

  const fresh = db.select().from(users).where(eq(users.id, user.id)).get();
  /* v8 ignore next */
  if (!fresh) throw error(404, 'Utilisateur introuvable');
  const last = fresh.lastExportAt instanceof Date ? fresh.lastExportAt.getTime() : null;
  const now = Date.now();
  if (last !== null && now - last < EXPORT_THROTTLE_MS) {
    throw error(429, 'Export déjà demandé récemment, veuillez réessayer dans une minute.');
  }

  const payload = exportUserData(user.id);
  db.update(users)
    .set({ lastExportAt: new Date(now) })
    .where(eq(users.id, user.id))
    .run();

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
