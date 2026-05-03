import type { Membership, SafeUser } from '$lib/types';

declare global {
  namespace App {
    interface Locals {
      user: SafeUser | null;
      memberships: Membership[];
      sessionId: string | null;
    }
    // interface PageData {}
    // interface Error {}
    // interface Platform {}
  }
}

export {};
