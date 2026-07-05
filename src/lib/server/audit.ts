import type { ReactionId } from '$lib/utils/reactions';

// Structured audit log for sensitive account operations. Emitted as a single
// JSON line to stdout so the deployment platform's log aggregator captures it
// durably alongside application logs. Deliberately no email, IP or other
// directly-identifying PII : the numeric user id is enough to reconstruct
// who did what (correlate with the users row by id, which the operator
// already has access to anyway).
//
// RGPD article 5(2) "accountability" requires the controller to be able to
// demonstrate compliance. For account-level operations (data export under
// article 15, deletion under article 17) that means a durable record of the
// action, the subject, and the outcome.

export type AuditEvent =
  | { type: 'account.exported'; userId: number; foodEntryCount: number }
  // Article-15 requests we received but refused (export too large). Logged
  // separately so the operator can still demonstrate the request was handled
  // even when no payload was returned.
  | {
      type: 'account.export_blocked';
      userId: number;
      reason: 'too_large';
      count: number;
      limit: number;
    }
  | {
      type: 'account.deleted';
      userId: number;
      deletedChildren: number;
      promotedMemberships: number;
      removedMemberships: number;
    }
  // Credential lifecycle events. RGPD article 32 (security of processing)
  // and article 33 (breach notification) both expect the controller to
  // reconstruct the timeline of credential changes : what happened, to
  // whom, and when. We log these on success only; a failed verifyPassword
  // already shows up in the rate-limit + stderr trail.
  | { type: 'account.password_changed'; userId: number }
  | { type: 'account.passkey_added'; userId: number; passkeyId: string }
  | { type: 'account.passkey_deleted'; userId: number; passkeyId: string }
  | { type: 'account.passkey_renamed'; userId: number; passkeyId: string }
  // logoutEverywhere: the user explicitly revoked every live session for
  // their account (e.g. after losing a device). Useful audit signal in a
  // breach-investigation context : the operator can see "X revoked all
  // sessions at T" alongside the surrounding error/access patterns.
  | { type: 'account.sessions_revoked'; userId: number }
  | {
      type: 'symptom.added';
      userId: number;
      childId: number;
      entryId: number;
      label: string;
    }
  | {
      type: 'symptom.deleted';
      userId: number;
      childId: number;
      entryId: number;
      symptomId: number;
    }
  | {
      type: 'food_entry.reaction_promoted';
      userId: number;
      childId: number;
      entryId: number;
      from: Extract<ReactionId, 'ras'>;
      to: Exclude<ReactionId, 'ras'>;
      triggeredBy: number; // symptom id
    }
  // Auth lifecycle. Enough to reconstruct "I tried to log in / sign up and it
  // broke" without storing email or IP. login_failed deliberately carries NO
  // userId : we must not record which account a failed attempt targeted (it
  // would turn the audit log into an account-enumeration oracle), and on a
  // wrong-email attempt there is no user to name anyway.
  | { type: 'auth.login_succeeded'; userId: number; method: 'password' | 'passkey' }
  | { type: 'auth.login_failed'; method: 'password' | 'passkey' }
  | { type: 'auth.logout'; userId: number }
  | { type: 'auth.signup'; userId: number; viaInvite: boolean }
  // Invitation lifecycle. The bearer code is a secret/credential, so it is
  // never logged — childId + actor are enough to debug "my co-parent can't
  // join". redeemed.userId is the joining user; created/revoked.userId is the
  // owner acting on their own child.
  | { type: 'invite.created'; userId: number; childId: number }
  | { type: 'invite.redeemed'; userId: number; childId: number }
  | { type: 'invite.revoked'; userId: number; childId: number }
  // Core write path — the literal "it broke when I tapped log" surface. created
  // omits entryId (the insert is inside an idempotency/milestone transaction
  // that doesn't surface the row id); update/delete have it from the route.
  // count: number of food_entries rows inserted by this action call (>1 for a
  // multi-ingredient meal sharing one mealId).
  | { type: 'food_entry.created'; userId: number; childId: number; count?: number }
  | { type: 'food_entry.updated'; userId: number; childId: number; entryId: number }
  | { type: 'food_entry.deleted'; userId: number; childId: number; entryId: number }
  | { type: 'child.created'; userId: number; childId: number }
  // Collaboration changes. removed: an owner removed someone (removedUserId);
  // left: a member removed themselves.
  | { type: 'membership.removed'; userId: number; childId: number; removedUserId: number }
  | { type: 'membership.left'; userId: number; childId: number };

export function audit(event: AuditEvent): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'audit',
      ...event
    })
  );
}
