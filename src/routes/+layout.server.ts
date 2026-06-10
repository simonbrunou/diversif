import { db } from '$lib/server/db';
import { children } from '$lib/server/db/schema';
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
  // `id` param, paraglide's reroute runs before matching (so /en/child/1 still
  // resolves it), and the static /child/new route shadows [id] (so 'new' can
  // never appear). Reading params instead of `url` also keeps this load from
  // re-running — children query included — on every client-side navigation.
  // Digits-only rejects malformed ids (/child/12abc) that the child layout
  // 404s anyway, so the shell never claims a child context the route refused.
  const currentChildIdStr = params.id && /^\d+$/.test(params.id) ? params.id : null;

  return {
    user: locals.user,
    children: childList,
    currentChildId: currentChildIdStr
  };
};
