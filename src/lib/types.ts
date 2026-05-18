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
};

export type SymptomEntry = {
  id: number;
  label: SymptomLabel;
  observedAt: string;
  note: string | null;
};
