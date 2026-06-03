import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { children, memberships } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/guards';
import { isValidBirthDate } from '$lib/utils/dates';
import { createInvitationForChild } from '$lib/server/invitations';
import type { Actions, PageServerLoad } from './$types';

const schema = z.object({
  firstName: z.string().min(1, 'Prénom requis').max(80),
  birthDate: z.string().refine(isValidBirthDate, 'Date invalide')
});

export const load: PageServerLoad = async ({ locals, parent }) => {
  requireUser(locals);
  // True only when the user owns no child yet : lets the page render a
  // warmer "welcome aboard" header instead of the utilitarian "Ajouter
  // un enfant". Co-parents who only have member memberships still get
  // the warm greeting the first time they create their own child.
  const { children: existing } = await parent();
  return { isFirstChild: existing.every((c) => c.role !== 'owner') };
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const user = requireUser(locals);
    const formData = await request.formData();
    const raw = Object.fromEntries(formData);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues;
      const errors: Record<string, string> = {};
      for (const issue of issues) {
        const field = issue.path[0] as string;
        if (!errors[field]) errors[field] = issue.message;
      }
      return fail(400, {
        firstName: typeof raw.firstName === 'string' ? raw.firstName : /* v8 ignore next */ '',
        birthDate: typeof raw.birthDate === 'string' ? raw.birthDate : /* v8 ignore next */ '',
        errors
      });
    }

    const now = new Date();
    const inserted = (
      await db
        .insert(children)
        .values({
          name: parsed.data.firstName.trim(),
          birthDate: parsed.data.birthDate,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now
        })
        .returning({ id: children.id })
    )[0];

    await db
      .insert(memberships)
      .values({ userId: user.id, childId: inserted.id, role: 'owner', createdAt: now });

    const inviteCoparent = formData.get('inviteCoparent') === '1';
    let redirectQuery = '';
    if (inviteCoparent) {
      const code = await createInvitationForChild({ childId: inserted.id, createdBy: user.id });
      /* v8 ignore next : code === null only after 5 random-code collisions (~1-in-trillion) */
      redirectQuery = code ? `?inviteCode=${code}` : '?invite=failed';
    }

    throw localizedRedirect(locals.locale, 303, `/child/${inserted.id}${redirectQuery}`);
  }
};
