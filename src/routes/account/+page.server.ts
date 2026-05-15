import { and, eq, ne } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { children, memberships, users } from '$lib/server/db/schema';
import { ageInMonths } from '$lib/utils/age';
import { listPasskeys, publicPasskey } from '$lib/server/passkeys';
import { requireUser } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

const VALID_THEMES = new Set(['system', 'light', 'dark'] as const);

export const load: PageServerLoad = async ({ locals, cookies }) => {
  const user = requireUser(locals);
  const passkeys = (await listPasskeys(user.id)).map(publicPasskey);

  const myMemberships = await db
    .select({
      childId: memberships.childId,
      childName: children.name,
      childBirthDate: children.birthDate
    })
    .from(memberships)
    .innerJoin(children, eq(children.id, memberships.childId))
    .where(eq(memberships.userId, user.id));

  const childrenData = await Promise.all(
    myMemberships.map(async (row) => {
      const coparents = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          role: memberships.role
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.childId, row.childId), ne(memberships.userId, user.id)));

      return {
        id: String(row.childId),
        name: row.childName,
        ageMonths: ageInMonths(row.childBirthDate),
        coparents: coparents.map((c) => ({
          id: String(c.id),
          displayName: c.displayName,
          role: c.role
        }))
      };
    })
  );

  const locale = (locals.locale /* v8 ignore next */ ?? 'fr') as 'fr' | 'en';

  const rawTheme = cookies.get('theme');
  const theme: 'system' | 'light' | 'dark' = VALID_THEMES.has(rawTheme as 'system')
    ? (rawTheme as 'system' | 'light' | 'dark')
    : 'system';

  return {
    passkeys,
    children: childrenData,
    locale,
    theme
  };
};
