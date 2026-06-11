import { AlertCircle, OctagonAlert, Smile, type Icon as LucideIcon } from 'lucide-svelte';
import * as m from '$lib/paraglide/messages';
import type { ReactionId } from './reaction-values';

// Single source of truth for the id value space — shared with schema.ts and
// the Zod form schemas, which must stay free of lucide-svelte imports.
export type { ReactionId } from './reaction-values';

export const REACTIONS = [
  { id: 'ras', icon: Smile },
  { id: 'inconfort', icon: AlertCircle },
  { id: 'reaction', icon: OctagonAlert }
] as const satisfies ReadonlyArray<{
  id: ReactionId;
  icon: typeof LucideIcon;
}>;

// Reaction labels and descriptions go through paraglide so the EN locale gets
// English copy. An unknown id falls back to the id string itself, matching
// the prior behavior (same pattern as CATEGORY_LABEL_RESOLVERS in
// $lib/utils/categories).
// i18n-keep: reactionsRasLabel reactionsRasDescription reactionsInconfortLabel reactionsInconfortDescription reactionsReactionLabel reactionsReactionDescription
const REACTION_LABEL_RESOLVERS: Record<ReactionId, () => string> = {
  ras: m.reactionsRasLabel,
  inconfort: m.reactionsInconfortLabel,
  reaction: m.reactionsReactionLabel
};

const REACTION_DESCRIPTION_RESOLVERS: Record<ReactionId, () => string> = {
  ras: m.reactionsRasDescription,
  inconfort: m.reactionsInconfortDescription,
  reaction: m.reactionsReactionDescription
};

export function getReactionLabel(id: ReactionId): string {
  return REACTION_LABEL_RESOLVERS[id]?.() ?? id;
}

export function getReactionDescription(id: ReactionId): string {
  return REACTION_DESCRIPTION_RESOLVERS[id]?.() ?? id;
}
