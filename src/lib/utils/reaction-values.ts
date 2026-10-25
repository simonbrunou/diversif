// Pure module (no Svelte/lucide imports) so drizzle-kit can load it when it
// evaluates schema.ts outside the Vite/SvelteKit alias resolver — mirrors the
// TEXTURE_VALUES pattern in ./textures.ts.
export const REACTION_VALUES = ['ras', 'inconfort', 'reaction'] as const;

export type ReactionId = (typeof REACTION_VALUES)[number];

// The one worst-reaction ordering (ras < inconfort < reaction), derived from
// REACTION_VALUES so the rank can never drift from the id space. Shared by the
// "worst reaction" aggregations (the child history, the allergen history,
// meals.ts, the Carnet, menu and pediatrician-report loads) and, through
// moreSevere, by the repas edit's reaction rule (src/lib/server/repas and the
// edit page) instead of each re-declaring the same literal map.
export const REACTION_RANK = Object.fromEntries(REACTION_VALUES.map((id, i) => [id, i])) as Record<
  ReactionId,
  number
>;

/** The more severe of two reactions (`a` when they are equal). */
export function moreSevere(a: ReactionId, b: ReactionId): ReactionId {
  return REACTION_RANK[a] >= REACTION_RANK[b] ? a : b;
}

/** Stored reactions by food entry id, as a refused repas edit hands them back (#445). */
export type ReactionsByEntry = Record<number, ReactionId>;
