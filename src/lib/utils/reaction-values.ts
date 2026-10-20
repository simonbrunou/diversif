// Pure module (no Svelte/lucide imports) so drizzle-kit can load it when it
// evaluates schema.ts outside the Vite/SvelteKit alias resolver — mirrors the
// TEXTURE_VALUES pattern in ./textures.ts.
export const REACTION_VALUES = ['ras', 'inconfort', 'reaction'] as const;

export type ReactionId = (typeof REACTION_VALUES)[number];

// Canonical worst-reaction ordering (ras < inconfort < reaction), derived from
// REACTION_VALUES so the rank can never drift from the id space. Shared by the
// "worst reaction" aggregations (repeat-candidates, meals.ts, the Carnet,
// menu and pediatrician-report loads, the allergen history) instead of each
// re-declaring the same literal map. One hand-kept copy remains: the SQL CASE
// in guidance/queries/diversity.ts.
export const REACTION_RANK = Object.fromEntries(REACTION_VALUES.map((id, i) => [id, i])) as Record<
  ReactionId,
  number
>;
