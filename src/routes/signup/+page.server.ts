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
import type { Actions, PageServerLoad } from './$types';

const schema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(12, 'Mot de passe trop court (12 caractères minimum)'),
  displayName: z.string().min(1, 'Nom requis').max(80),
  inviteCode: z
    .string()
    .optional()
    .transform((s) => (s ? s.toUpperCase().trim() : ''))
});

export const load: PageServerLoad = async ({ locals, url }) => {
  requireGuest(locals);
  return { inviteCode: url.searchParams.get('code')?.toUpperCase() ?? '' };
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
    const raw = Object.fromEntries(await request.formData());
    const parsed = schema.safeParse(raw);

    const formEmail = typeof raw.email === 'string' ? raw.email : '';
    const formDisplayName = typeof raw.displayName === 'string' ? raw.displayName : '';
    const formInvite = typeof raw.inviteCode === 'string' ? raw.inviteCode : '';

    if (!parsed.success) {
      return fail(400, {
        email: formEmail,
        displayName: formDisplayName,
        inviteCode: formInvite,
        error: parsed.error.issues[0]?.message ?? 'Champs invalides'
      });
    }

    const { email, password, displayName, inviteCode } = parsed.data;
    const lowerEmail = email.toLowerCase();

    if (findUserByEmail(lowerEmail)) {
      return fail(400, {
        email: formEmail,
        displayName: formDisplayName,
        inviteCode: formInvite,
        error: 'Un compte existe déjà pour cet email.'
      });
    }

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

    const passwordHash = await hashPassword(password);
    const now = new Date();

    const inserted = db
      .insert(users)
      .values({ email: lowerEmail, passwordHash, displayName, createdAt: now })
      .returning({ id: users.id })
      .get();
    const userId = inserted.id;

    if (invitationChildId !== null && inviteCode) {
      db.insert(memberships)
        .values({
          userId,
          childId: invitationChildId,
          role: 'member',
          createdAt: now
        })
        .run();
      db.update(invitations)
        .set({ usedAt: now, usedBy: userId })
        .where(eq(invitations.code, inviteCode))
        .run();
    }

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
