// Structured audit log for sensitive account operations. Emitted as a single
// JSON line to stdout so the deployment platform's log aggregator captures it
// durably alongside application logs. Deliberately no email, IP or other
// directly-identifying PII — the numeric user id is enough to reconstruct
// who did what (correlate with the users row by id, which the operator
// already has access to anyway).
//
// RGPD article 5(2) "accountability" requires the controller to be able to
// demonstrate compliance. For account-level operations (data export under
// article 15, deletion under article 17) that means a durable record of the
// action, the subject, and the outcome.

export type AuditEvent =
  | { type: 'account.exported'; userId: number; foodEntryCount: number }
  | {
      type: 'account.deleted';
      userId: number;
      deletedChildren: number;
      promotedMemberships: number;
      removedMemberships: number;
    };

export function audit(event: AuditEvent): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'audit',
      ...event
    })
  );
}
