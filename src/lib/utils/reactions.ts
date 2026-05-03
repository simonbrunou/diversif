export const REACTIONS = [
  { id: 'ras', label: 'RAS', description: 'Rien à signaler' },
  { id: 'inconfort', label: 'Inconfort', description: 'Léger inconfort' },
  { id: 'reaction', label: 'Réaction', description: 'Réaction notable' }
] as const;

export type ReactionId = (typeof REACTIONS)[number]['id'];

export function getReactionLabel(id: ReactionId): string {
  return REACTIONS.find((r) => r.id === id)?.label ?? id;
}
