import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { requireUser } from '$lib/server/guards';
import { parseFormWithKey } from '$lib/server/forms';
import type { Actions, PageServerLoad } from './$types';

const profileSchema = z.object({
  displayName: z.string().min(1).max(80)
});

export const load: PageServerLoad = async ({ locals }) => {
  requireUser(locals);
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals }) => {
    const user = requireUser(locals);
    const parsed = await parseFormWithKey(request, profileSchema, {
      field: 'profileErrorKey',
      badInputKey: 'errorsAccountProfileNameInvalid'
    });
    if (!parsed.ok) return parsed.failure;
    await db
      .update(users)
      .set({ displayName: parsed.data.displayName.trim() })
      .where(eq(users.id, user.id));
    return { profileSuccessKey: 'errorsAccountProfileSuccess' };
  }
};
