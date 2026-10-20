import { db } from './db';
import { invitations } from './db/schema';
import { DAY_MS } from '#lib/utils/civil-calendar.js';
import { generateInviteCodeRaw } from '#lib/utils/invites.js';
import { isUniqueViolation } from './db/errors';

const INVITE_DURATION_MS = 7 * DAY_MS;

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
      /* v8 ignore start : defensive: any non-23505 error bubbles up unchanged */
      if (!isUniqueViolation(err)) throw err;
      /* v8 ignore stop */
    }
  }
  return null;
}
