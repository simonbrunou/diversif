import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { children, memberships } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/guards';
import { isValidBirthDate } from '$lib/utils/dates';
import type { Actions, PageServerLoad } from './$types';

const schema = z.object({
  name: z.string().min(1, 'Prénom requis').max(80),
  birthDate: z.string().refine(isValidBirthDate, 'Date invalide')
});

export const load: PageServerLoad = async ({ locals }) => {
  requireUser(locals);
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const user = requireUser(locals);
    const raw = Object.fromEntries(await request.formData());
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return fail(400, {
        name: typeof raw.name === 'string' ? raw.name : /* v8 ignore next */ '',
        birthDate: typeof raw.birthDate === 'string' ? raw.birthDate : /* v8 ignore next */ '',
        error: parsed.error.issues[0]?.message ?? /* v8 ignore next */ 'Champs invalides'
      });
    }

    const now = new Date();
    const inserted = db
      .insert(children)
      .values({
        name: parsed.data.name.trim(),
        birthDate: parsed.data.birthDate,
        createdBy: user.id,
        createdAt: now
      })
      .returning({ id: children.id })
      .get();

    db.insert(memberships)
      .values({ userId: user.id, childId: inserted.id, role: 'owner', createdAt: now })
      .run();

    throw redirect(303, `/child/${inserted.id}`);
  }
};
