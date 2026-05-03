import type { User, Membership } from './server/db/schema';

export type SafeUser = Omit<User, 'passwordHash'>;
export type { Membership };

export type ChildSummary = {
  id: number;
  name: string;
  birthDate: string;
  role: 'owner' | 'member';
};

export type DashboardEntry = {
  id: number;
  givenAt: number;
  reaction: 'ras' | 'inconfort' | 'reaction';
  notes: string | null;
  foodId: number;
  foodName: string;
  category: string;
  loggedByName: string;
};
