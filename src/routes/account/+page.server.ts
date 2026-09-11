import { and, eq, inArray, ne } from 'drizzle-orm';
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

  const childIds = myMemberships.map((row) => row.childId);
  // One batched query for every co-parent across all of the user's children
  // instead of one round-trip per child (same "one query, group in memory"
  // shape as aggregateBentoFoods in foods/+page.server.ts). `inArray` on an
  // empty array is a no-op query, so this stays correct with zero children.
  const allCoparents =
    childIds.length === 0
      ? []
      : await db
          .select({
            childId: memberships.childId,
            id: users.id,
            displayName: users.displayName,
            role: memberships.role
          })
          .from(memberships)
          .innerJoin(users, eq(users.id, memberships.userId))
          .where(and(inArray(memberships.childId, childIds), ne(memberships.userId, user.id)));

  const coparentsByChildId = new Map<number, typeof allCoparents>();
  for (const c of allCoparents) {
    const list = coparentsByChildId.get(c.childId);
    if (list) list.push(c);
    else coparentsByChildId.set(c.childId, [c]);
  }

  const childrenData = myMemberships.map((row) => ({
    id: String(row.childId),
    name: row.childName,
    ageMonths: ageInMonths(row.childBirthDate),
    coparents: (coparentsByChildId.get(row.childId) ?? []).map((c) => ({
      id: String(c.id),
      displayName: c.displayName,
      role: c.role
    }))
  }));

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
