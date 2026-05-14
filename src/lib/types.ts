import type { User, Membership } from './server/db/schema';
import type { SymptomLabel } from './content/symptoms';

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
  category: string;
  reaction: 'ras' | 'inconfort' | 'reaction';
  givenAt: number;
};

export type SymptomEntry = {
  id: number;
  label: SymptomLabel;
  observedAt: string;
  note: string | null;
};
