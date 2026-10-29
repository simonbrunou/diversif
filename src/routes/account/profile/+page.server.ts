import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import { requireUser } from '#lib/server/guards.js';
import { parseFormWithKey } from '#lib/server/forms.js';
import type { Actions, PageServerLoad } from './$types';

const profileSchema = z.object({
  // Trimmed before the length checks, so a name of only spaces fails min(1).
  displayName: z.string().trim().min(1).max(80)
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
      .set({ displayName: parsed.data.displayName })
      .where(eq(users.id, user.id));
    return { profileSuccessKey: 'errorsAccountProfileSuccess' };
  }
};
