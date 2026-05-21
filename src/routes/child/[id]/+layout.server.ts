import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { children } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { requireChildContext } from '$lib/server/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
  // requireUser before the integer check so unauthed visitors hit /login
  // rather than a 404 when the URL has a malformed id.
  const { childId, membership } = requireChildContext(locals, params);

  const child = (await db.select().from(children).where(eq(children.id, childId)).limit(1))[0];
  if (!child) throw error(404, 'Enfant introuvable');

  return {
    child: {
      id: child.id,
      name: child.name,
      birthDate: child.birthDate,
      // Drizzle materialises this as a Date; serialise to ms for client transport
      // and to spare child pages a second SELECT just for createdAt.
      createdAt: child.createdAt.getTime()
    },
    membership
  };
};
