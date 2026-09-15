import type { User, Membership } from './server/db/schema';
import type { SymptomLabel } from './content/symptoms';
import type { TextureKey } from '$lib/utils/textures';
import type { CategoryId } from '$lib/utils/categories';
import type { ReactionId } from '$lib/utils/reactions';

export type SafeUser = Omit<User, 'passwordHash'>;
export type { Membership };

export type ChildSummary = {
  id: number;
  name: string;
  birthDate: string;
  role: 'owner' | 'member';
};

export type RecentEntry = {
  id: number;
  foodId: number;
  foodName: string;
  category: CategoryId;
  reaction: ReactionId;
  givenAt: number;
  texture: TextureKey | null;
  mealId: string | null;
  /**
   * Display name of the co-parent who recorded this entry. The dashboard
   * loader has always selected it (falling back to "Compte supprimé" for a
   * deleted account) but it was missing from this contract, so the feed had
   * no typed way to show who logged what in a shared carnet.
   */
  loggedByName: string;
};

export type SymptomEntry = {
  id: number;
  label: SymptomLabel;
  observedAt: string;
  note: string | null;
};
