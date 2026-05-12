import { db } from './db';
import { invitations } from './db/schema';
import { generateInviteCodeRaw } from '$lib/utils/invites';
import { isUniqueViolation } from './db/errors';

const INVITE_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export async function createInvitationForChild(input: {
  childId: number;
  createdBy: number;
}): Promise<string | null> {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + INVITE_DURATION_MS);
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCodeRaw();
    try {
      await db.insert(invitations).values({
        code,
        childId: input.childId,
        createdBy: input.createdBy,
        createdAt,
        expiresAt,
        usedAt: null,
        usedBy: null
      });
      return code;
    } catch (err) {
      /* v8 ignore start — defensive: any non-23505 error bubbles up unchanged */
      if (!isUniqueViolation(err)) throw err;
      /* v8 ignore stop */
    }
  }
  return null;
}
