import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { invitations, memberships, users } from '$lib/server/db/schema';
import { isUniqueViolation } from '$lib/server/db/errors';
import { audit } from '$lib/server/audit';
import { and, eq, gt, isNull } from 'drizzle-orm';
import {
  createSession,
  findUserByEmail,
  hashPassword,
  isValidInviteCodeFormat,
  setSessionCookie
} from '$lib/server/auth';
import { requireGuest } from '$lib/server/guards';
import { parseFormWithKey } from '$lib/server/forms';
import { checkRateLimit, clientKey } from '$lib/server/rate-limit';
import { isE2E } from '$lib/server/e2e';
import type { Actions, PageServerLoad } from './$types';

// Per-IP signup ceiling. 20/hour comfortably accommodates shared egress
// (corporate proxies, family households, CI runs) while still keeping a
// scripted abuser firmly throttled. The bucket is keyed by client IP so the
// public Internet-facing operator MUST configure ADDRESS_HEADER for adapter-
// node when behind a reverse proxy : otherwise the proxy IP looks like one
// noisy client.
const SIGNUP_LIMIT = {
  name: 'signup',
  // Playwright sets E2E=1 + ORIGIN=http://localhost in its webServer env; the
  // suite legitimately runs dozens of signups from one address in a few
  // minutes, so the throttle relaxes there. isE2E() requires both signals, so
  // a stray E2E=1 on a real deployment keeps the 20/hour ceiling.
  /* v8 ignore next : E2E branch covered by the Playwright suite */
  limit: isE2E() ? 200 : 20,
  windowMs: 60 * 60 * 1000
};

const schema = z.object({
  // Same 254-octet bound as login: keeps the stored identifier (and any
  // rate-limit key derived from it) within the RFC 5321 deliverable cap.
  email: z.email('Adresse e-mail invalide').max(254, 'Adresse e-mail invalide'),
  password: z.string().min(12, 'Mot de passe trop court (12 caractères minimum)'),
  displayName: z.string().min(1, 'Nom requis').max(80),
  inviteCode: z
    .string()
    .optional()
    .transform((s) => (s ? s.toUpperCase().trim() : '')),
  acceptTos: z.literal('on', {
    error: `Vous devez accepter les conditions générales d'utilisation.`
  }),
  acceptPrivacy: z.literal('on', {
    error: `Vous devez accepter la politique de confidentialité.`
  }),
  confirmAge15: z.literal('on', {
    error: `Vous devez confirmer avoir au moins 15 ans.`
  })
});

export const load: PageServerLoad = async ({ locals, url }) => {
  requireGuest(locals);
  return { inviteCode: url.searchParams.get('code')?.toUpperCase() ?? '' };
};

class InviteRace extends Error {}

// Resolve an optional invite code to its child id. Validated BEFORE the
// duplicate-email check so a bad invite always wins regardless of whether the
// email is registered — otherwise an attacker could XOR the generic
// "impossible" (registered email) against the specific invite error
// (unregistered email) to enumerate registered addresses.
async function resolveInviteChild(
  inviteCode: string | undefined
): Promise<{ ok: true; childId: number | null } | { ok: false; errorKey: string }> {
  if (!inviteCode) return { ok: true, childId: null };
  if (!isValidInviteCodeFormat(inviteCode)) {
    return { ok: false, errorKey: 'errorsAuthInvalidInvite' };
  }
  const inv = (
    await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.code, inviteCode),
          isNull(invitations.usedAt),
          gt(invitations.expiresAt, new Date())
        )
      )
      .limit(1)
  )[0];
  if (!inv) return { ok: false, errorKey: 'errorsAuthInvalidInviteExpired' };
  return { ok: true, childId: inv.childId };
}

// User insert + optional invitation consumption + membership, committed
// atomically (a crash mid-way would otherwise orphan the account from the child
// it was invited to). The invitation read in resolveInviteChild is unlocked, so
// two concurrent signups sharing a code can both pass it; we condition the
// UPDATE on `used_at IS NULL` and throw InviteRace (rolling back the whole tx,
// leaving no phantom account) when we lose the race.
function insertSignupUser(params: {
  lowerEmail: string;
  passwordHash: string;
  displayName: string;
  now: Date;
  inviteCode: string | undefined;
  invitationChildId: number | null;
}): number {
  const { lowerEmail, passwordHash, displayName, now, inviteCode, invitationChildId } = params;
  return db.transaction((tx) => {
    const inserted = tx
      .insert(users)
      .values({
        email: lowerEmail,
        passwordHash,
        displayName,
        createdAt: now,
        tosAcceptedAt: now,
        privacyAcceptedAt: now,
        ageConfirmedAt: now,
        lastLoginAt: now
      })
      .returning({ id: users.id })
      .all()[0];
    const id = inserted.id;

    if (invitationChildId !== null && inviteCode) {
      const result = tx
        .update(invitations)
        .set({ usedAt: now, usedBy: id })
        .where(and(eq(invitations.code, inviteCode), isNull(invitations.usedAt)))
        .returning({ code: invitations.code })
        .all();
      if (result.length === 0) throw new InviteRace();
      tx.insert(memberships)
        .values({
          userId: id,
          childId: invitationChildId,
          role: 'member',
          createdAt: now
        })
        .run();
    }

    return id;
  });
}

export const actions: Actions = {
  default: async (event) => {
    const { request, cookies } = event;
    const ip = clientKey(event);
    const rl = checkRateLimit(SIGNUP_LIMIT, ip);
    if (!rl.allowed) {
      return fail(429, {
        email: '',
        displayName: '',
        inviteCode: '',
        errorKey: 'errorsAuthRateLimited'
      });
    }

    const parsed = await parseFormWithKey(request, schema, {
      field: 'errorKey',
      badInputKey: 'errorsAuthBadInput',
      echo: ['email', 'displayName', 'inviteCode']
    });
    if (!parsed.ok) return parsed.failure;

    const { email, password, displayName, inviteCode } = parsed.data;
    const formEmail = email;
    const formDisplayName = displayName;
    const formInvite = inviteCode;
    const lowerEmail = email.toLowerCase();

    const failWith = (status: number, errorKey: string) =>
      fail(status, {
        email: formEmail,
        displayName: formDisplayName,
        inviteCode: formInvite,
        errorKey
      });

    const invite = await resolveInviteChild(inviteCode);
    if (!invite.ok) return failWith(400, invite.errorKey);
    const invitationChildId = invite.childId;

    // Invite-only mode (opt-in via INVITE_ONLY=true): registration requires a
    // valid, unexpired invite. Checked AFTER invite resolution but BEFORE the
    // duplicate-email lookup, so the response never depends on whether the
    // email is registered (same enumeration-safety reasoning as the
    // invite-first ordering above). Unset/anything-else keeps signup open.
    if (process.env.INVITE_ONLY === 'true' && invitationChildId === null) {
      return failWith(403, 'errorsAuthInviteRequired');
    }

    if (await findUserByEmail(lowerEmail)) {
      // Generic message : the previous "compte existe déjà" wording let an
      // attacker enumerate registered addresses by attempting to sign up.
      // The new copy gently nudges existing users towards /login without
      // confirming whether the address is on file. A residual leak still
      // exists between this 400 and the success-redirect for an
      // unregistered email; closing it fully would require an email
      // confirmation flow, which we don't have yet.
      return failWith(400, 'errorsAuthSignupImpossible');
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    let userId: number;
    try {
      userId = insertSignupUser({
        lowerEmail,
        passwordHash,
        displayName,
        now,
        inviteCode,
        invitationChildId
      });
    } catch (err) {
      if (err instanceof InviteRace) return failWith(400, 'errorsAuthInvalidInviteExpired');
      // The findUserByEmail check above is unlocked, so two concurrent signups
      // with the same email can both pass it; the loser hits users.email's
      // UNIQUE constraint at INSERT time. Map the resulting unique violation to
      // the same generic "signup impossible" 400 used for the read path so a
      // normal double-submit doesn't surface as a 500.
      if (isUniqueViolation(err)) return failWith(400, 'errorsAuthSignupImpossible');
      throw err;
    }

    const { token } = await createSession(userId);
    setSessionCookie(cookies, token);
    audit({ type: 'auth.signup', userId, viaInvite: invitationChildId !== null });
    if (invitationChildId !== null) {
      audit({ type: 'invite.redeemed', userId, childId: invitationChildId });
    }

    throw localizedRedirect(
      event.locals.locale,
      303,
      invitationChildId !== null ? `/child/${invitationChildId}` : '/'
    );
  }
};
