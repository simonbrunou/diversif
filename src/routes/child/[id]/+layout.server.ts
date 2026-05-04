import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { children } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { requireMembership, requireUser } from '$lib/server/guards';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
  requireUser(locals);
  const childId = Number(params.id);
  if (!Number.isInteger(childId) || childId <= 0) throw error(404, 'Enfant introuvable');

  const membership = requireMembership(locals, childId);

  const child = db.select().from(children).where(eq(children.id, childId)).get();
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
