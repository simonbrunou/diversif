import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { db } from '$lib/server/db';
import { invitations, memberships, users } from '$lib/server/db/schema';
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
const SIGNUP_LIMIT = { name: 'signup', limit: 20, windowMs: 60 * 60 * 1000 };

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(12, 'Mot de passe trop court (12 caractères minimum)'),
  displayName: z.string().min(1, 'Nom requis').max(80),
  inviteCode: z
    .string()
    .optional()
    .transform((s) => (s ? s.toUpperCase().trim() : '')),
  acceptTos: z.literal('on', {
    errorMap: () => ({ message: 'Vous devez accepter les conditions générales d’utilisation.' })
  }),
  acceptPrivacy: z.literal('on', {
    errorMap: () => ({ message: 'Vous devez accepter la politique de confidentialité.' })
  }),
  confirmAge15: z.literal('on', {
    errorMap: () => ({ message: 'Vous devez confirmer avoir au moins 15 ans.' })
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
        error: `Trop d’inscriptions récentes. Réessayez dans ${rl.retryAfterSeconds}s.`
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
        error: parsed.error.issues[0]?.message ?? /* v8 ignore next */ 'Champs invalides'
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
          error: 'Code d’invitation invalide.'
        });
      }
      const inv = db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.code, inviteCode),
            isNull(invitations.usedAt),
            gt(invitations.expiresAt, new Date())
          )
        )
        .get();
      if (!inv) {
        return fail(400, {
          email: formEmail,
          displayName: formDisplayName,
          inviteCode: formInvite,
          error: 'Code d’invitation introuvable ou expiré.'
        });
      }
      invitationChildId = inv.childId;
    }

    if (findUserByEmail(lowerEmail)) {
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
        error: 'Inscription impossible. Si vous avez déjà un compte, essayez de vous connecter.'
      });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date();

    // Transaction: user insert + membership + invitation consumption must
    // commit atomically. Without it a crash between steps would leave a
    // user account that can't reach the child it was invited to, with the
    // invitation either already consumed (orphaned access) or still claimable
    // (lets a stranger reuse the code).
    const userId = db.transaction((tx) => {
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
        .get();
      const id = inserted.id;

      if (invitationChildId !== null && inviteCode) {
        tx.insert(memberships)
          .values({
            userId: id,
            childId: invitationChildId,
            role: 'member',
            createdAt: now
          })
          .run();
        tx.update(invitations)
          .set({ usedAt: now, usedBy: id })
          .where(eq(invitations.code, inviteCode))
          .run();
      }

      return id;
    });

    const session = createSession(userId);
    cookies.set(SESSION_COOKIE, session.id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: Math.floor(SESSION_DURATION_MS / 1000)
    });

    throw redirect(303, invitationChildId !== null ? `/child/${invitationChildId}` : '/');
  }
};
