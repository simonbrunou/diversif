import { db } from '$lib/server/db';
import { children } from '$lib/server/db/schema';
import { inArray } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import type { ChildSummary } from '$lib/types';
import { resolveOrigin } from '$lib/seo';

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

  const childMatch = url.pathname.match(/^\/child\/([^/]+)/);
  const currentChildIdStr = childMatch ? childMatch[1] : null;

  return {
    user: locals.user,
    children: childList,
    siteUrl: resolveOrigin(url),
    currentChildId: currentChildIdStr
  };
};
