import type { AvailableLanguageTag } from '$lib/paraglide/runtime';
import type { Membership, SafeUser } from '$lib/types';

declare global {
  namespace App {
    interface Locals {
      user: SafeUser | null;
      memberships: Membership[];
      sessionId: string | null;
      locale: AvailableLanguageTag;
    }
    // interface PageData {}
    interface Error {
      message: string;
      errorId?: string;
    }
    // interface Platform {}
  }
}

export {};
