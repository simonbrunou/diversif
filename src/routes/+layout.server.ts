import { db } from '$lib/server/db';
import { children } from '$lib/server/db/schema';
import { parseChildIdParam } from '$lib/server/guards';
import { inArray } from 'drizzle-orm';
import type { LayoutServerLoad } from './$types';
import type { ChildSummary } from '$lib/types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
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

  // `params.id` comes from the router: /child/[id] is the only route with an
  // `id` param (the static /child/new route shadows it), and reading params
  // instead of `url` keeps this load — children query included — from
  // re-running on every client-side navigation. Reusing the route guard's
  // parser keeps the shell and the child layout agreeing on validity ('0' is
  // rejected) and normalization ('007' → '7').
  let currentChildIdStr: string | null = null;
  try {
    currentChildIdStr = String(parseChildIdParam(params));
  } catch {
    // Not a child route, or a malformed id the child layout 404s anyway.
  }

  return {
    user: locals.user,
    children: childList,
    currentChildId: currentChildIdStr
  };
};
