import { AlertCircle, OctagonAlert, Smile, type Icon as LucideIcon } from 'lucide-svelte';

export const REACTIONS = [
  {
    id: 'ras',
    label: 'Tout va bien',
    description: 'Bébé a bien toléré, aucun signe particulier.',
    icon: Smile
  },
  {
    id: 'inconfort',
    label: 'Petit inconfort',
    description: 'Léger inconfort digestif ou cutané, à observer.',
    icon: AlertCircle
  },
  {
    id: 'reaction',
    label: 'Réaction marquée',
    description: 'Signes nets : arrêter et consulter un médecin.',
    icon: OctagonAlert
  }
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  icon: typeof LucideIcon;
}>;

export type ReactionId = (typeof REACTIONS)[number]['id'];

export function getReactionLabel(id: ReactionId): string {
  return REACTIONS.find((r) => r.id === id)?.label ?? id;
}
