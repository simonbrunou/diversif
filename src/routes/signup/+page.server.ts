import { fail } from '@sveltejs/kit';
import { localizedRedirect } from '$lib/server/redirect';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { invitations, memberships, users } from '$lib/server/db/schema';
import { isUniqueViolation } from '$lib/server/db/errors';
import { and, eq, gt, isNull } from 'drizzle-orm';
import {
  SESSION_COOKIE,
  SESSION_DURATION_MS,
  createSession,
  findUserByEmail,
  hashPassword,
  isValidInviteCodeFormat
} from '$lib/server/auth';
import { requireGuest } from '$lib/server/guards';
import { checkRateLimit, clientKey } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

// Per-IP signup ceiling. 20/hour comfortably accommodates shared egress
// (corporate proxies, family households, CI runs) while still keeping a
// scripted abuser firmly throttled. The bucket is keyed by client IP so the
// public Internet-facing operator MUST configure ADDRESS_HEADER for adapter-
// node when behind a reverse proxy — otherwise the proxy IP looks like one
// noisy client.
const SIGNUP_LIMIT = {
  name: 'signup',
  // Playwright sets E2E=1 in its webServer env; the suite legitimately runs
  // dozens of signups from one address in a few minutes, so the throttle
  // relaxes there. Production traffic keeps the 20/hour ceiling.
  /* v8 ignore next — E2E branch covered by the Playwright suite */
  limit: process.env.E2E === '1' ? 200 : 20,
  windowMs: 60 * 60 * 1000
};

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(12, 'Mot de passe trop court (12 caractères minimum)'),
  displayName: z.string().min(1, 'Nom requis').max(80),
  inviteCode: z
    .string()
    .optional()
    .transform((s) => (s ? s.toUpperCase().trim() : '')),
  acceptTos: z.literal('on', {
    errorMap: () => ({ message: `Vous devez accepter les conditions générales d'utilisation.` })
  }),
  acceptPrivacy: z.literal('on', {
    errorMap: () => ({ message: `Vous devez accepter la politique de confidentialité.` })
  }),
  confirmAge15: z.literal('on', {
    errorMap: () => ({ message: `Vous devez confirmer avoir au moins 15 ans.` })
  })
});

export const load: PageServerLoad = async ({ locals, url }) => {
  requireGuest(locals);
  return { inviteCode: url.searchParams.get('code')?.toUpperCase() ?? '' };
};

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

    const raw = Object.fromEntries(await request.formData());
    const parsed = schema.safeParse(raw);

    const formEmail = typeof raw.email === 'string' ? raw.email : /* v8 ignore next */ '';
    const formDisplayName =
      typeof raw.displayName === 'string' ? raw.displayName : /* v8 ignore next */ '';
    const formInvite =
      typeof raw.inviteCode === 'string' ? raw.inviteCode : /* v8 ignore next */ '';

    if (!parsed.success) {
      return fail(400, {
        email: formEmail,
        displayName: formDisplayName,
        inviteCode: formInvite,
        errorKey: 'errorsAuthBadInput'
      });
    }

    const { email, password, displayName, inviteCode } = parsed.data;
    const lowerEmail = email.toLowerCase();

    // Validate the invite code BEFORE checking the duplicate email. If we
    // returned the generic "Inscription impossible" for a registered email
    // but a more specific "Code d'invitation invalide" for an unregistered
    // one (when both sent the same bad invite), an attacker could XOR the
    // two responses to enumerate registered addresses. Running invite
    // validation first means a bad invite always wins regardless of email.
    let invitationChildId: number | null = null;
    if (inviteCode) {
      if (!isValidInviteCodeFormat(inviteCode)) {
        return fail(400, {
          email: formEmail,
          displayName: formDisplayName,
          inviteCode: formInvite,
          errorKey: 'errorsAuthInvalidInvite'
        });
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
      if (!inv) {
        return fail(400, {
          email: formEmail,
          displayName: formDisplayName,
          inviteCode: formInvite,
          errorKey: 'errorsAuthInvalidInviteExpired'
        });
      }
      invitationChildId = inv.childId;
    }

    if (await findUserByEmail(lowerEmail)) {
      // Generic message — the previous "compte existe déjà" wording let an
      // attacker enumerate registered addresses by attempting to sign up.
      // The new copy gently nudges existing users towards /login without
      // confirming whether the address is on file. A residual leak still
      // exists between this 400 and the success-redirect for an
      // unregistered email; closing it fully would require an email
      // confirmation flow, which we don't have yet.
      return fail(400, {
        email: formEmail,
        displayName: formDisplayName,
        inviteCode: formInvite,
        errorKey: 'errorsAuthSignupImpossible'
      });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    // Transaction: user insert + membership + invitation consumption must
    // commit atomically. Without it a crash between steps would leave a
    // user account that can't reach the child it was invited to, with the
    // invitation either already consumed (orphaned access) or still claimable
    // (lets a stranger reuse the code).
    //
    // The invitation read above is unlocked, so two concurrent signups
    // sharing the same code can both pass it. Condition the UPDATE on
    // `used_at IS NULL` and check `rowCount` to detect the race; if we lose
    // we throw a sentinel that rolls the whole transaction back (no phantom
    // account left behind) and surface the same expired-invite error the
    // read path uses.
    class InviteRace extends Error {}

    let userId: number;
    try {
      userId = await db.transaction(async (tx) => {
        const inserted = (
          await tx
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
        )[0];
        const id = inserted.id;

        if (invitationChildId !== null && inviteCode) {
          const result = await tx
            .update(invitations)
            .set({ usedAt: now, usedBy: id })
            .where(and(eq(invitations.code, inviteCode), isNull(invitations.usedAt)));
          /* v8 ignore next — node-postgres always populates rowCount for UPDATE */
          if ((result.rowCount ?? 0) === 0) throw new InviteRace();
          await tx.insert(memberships).values({
            userId: id,
            childId: invitationChildId,
            role: 'member',
            createdAt: now
          });
        }

        return id;
      });
    } catch (err) {
      if (err instanceof InviteRace) {
        return fail(400, {
          email: formEmail,
          displayName: formDisplayName,
          inviteCode: formInvite,
          errorKey: 'errorsAuthInvalidInviteExpired'
        });
      }
      // The findUserByEmail check above is unlocked, so two concurrent signups
      // with the same email can both pass it; the loser hits users.email's
      // UNIQUE constraint at INSERT time. Map the resulting 23505 to the same
      // generic "signup impossible" 400 used for the read path so a normal
      // double-submit doesn't surface as a 500.
      if (isUniqueViolation(err)) {
        return fail(400, {
          email: formEmail,
          displayName: formDisplayName,
          inviteCode: formInvite,
          errorKey: 'errorsAuthSignupImpossible'
        });
      }
      throw err;
    }

    const session = await createSession(userId);
    cookies.set(SESSION_COOKIE, session.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: Math.floor(SESSION_DURATION_MS / 1000)
    });
    cookies.set('bento', '1', {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365
    });

    throw localizedRedirect(
      event.locals.locale,
      303,
      invitationChildId !== null ? `/child/${invitationChildId}` : '/'
    );
  }
};
