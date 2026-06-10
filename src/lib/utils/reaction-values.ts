// Pure module (no Svelte/lucide imports) so drizzle-kit can load it when it
// evaluates schema.ts outside the Vite/SvelteKit alias resolver — mirrors the
// TEXTURE_VALUES pattern in ./textures.ts.
export const REACTION_VALUES = ['ras', 'inconfort', 'reaction'] as const;

export type ReactionId = (typeof REACTION_VALUES)[number];
