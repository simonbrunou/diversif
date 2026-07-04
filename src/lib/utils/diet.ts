// Pure module (no Svelte/lucide imports) so drizzle-kit can load it when it
// evaluates schema.ts outside the Vite/SvelteKit alias resolver — mirrors the
// REACTION_VALUES pattern in ./reaction-values.ts.
export const DIET_EXCLUSIONS = ['porc', 'vegetarien', 'sans_poisson'] as const;

export type DietExclusion = (typeof DIET_EXCLUSIONS)[number];

/**
 * Narrows an untrusted value (DB JSON column, form input, …) down to the
 * known DietExclusion id space. Unknown/invalid entries are dropped rather
 * than throwing, so a future removed/renamed id can't crash the menu engine.
 */
export function parseDietExclusions(raw: unknown): DietExclusion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is DietExclusion => (DIET_EXCLUSIONS as readonly string[]).includes(x));
}
