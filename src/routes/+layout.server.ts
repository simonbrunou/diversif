import { db } from '$lib/server/db';
import { children } from '$lib/server/db/schema';
import { i18n } from '$lib/i18n';
import { inArray } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import type { ChildSummary } from '$lib/types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
  let childList: ChildSummary[] = [];
  if (locals.user && locals.memberships.length > 0) {
    const childIds = locals.memberships.map((m) => m.childId);
    const rows = await db.select().from(children).where(inArray(children.id, childIds));
    const byId = new Map(rows.map((c) => [c.id, c]));
    childList = locals.memberships
      .map((m) => {
        const c = byId.get(m.childId);
        if (!c) return null;
        return {
          id: c.id,
          name: c.name,
          birthDate: c.birthDate,
          role: m.role
        } satisfies ChildSummary;
      })
      .filter((x): x is ChildSummary => x !== null);
  }

  // De-localize first (e.g. /en/child/1 → /child/1) so the EN locale keeps
  // its navigation, then match digits only so /child/new doesn't leak a bogus
  // currentChildId='new' into nav/FAB hrefs.
  const childMatch = i18n.route(url.pathname).match(/^\/child\/(\d+)/);
  const currentChildIdStr = childMatch ? childMatch[1] : null;

  return {
    user: locals.user,
    children: childList,
    currentChildId: currentChildIdStr
  };
};
