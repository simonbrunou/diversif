import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { deletePasskey, listPasskeys, publicPasskey, renamePasskey } from '$lib/server/passkeys';
import { requireUser } from '$lib/server/guards';
import { parseFormWithKey } from '$lib/server/forms';
import { requireFreshAuthWithKey } from '$lib/server/fresh-auth';
import { localizedRedirect } from '$lib/server/redirect';
import { audit } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

const renameSchema = z.object({
  id: z.string().min(1),
  name: z
    .string()
    .min(1)
    .refine((s) => s.trim().length > 0)
});

const deleteSchema = z.object({
  id: z.string().min(1),
  currentPassword: z.string().min(1)
});

export const load: PageServerLoad = async ({ locals }) => {
  const user = requireUser(locals);
  const passkeys = (await listPasskeys(user.id)).map(publicPasskey);
  return { passkeys };
};

export const actions: Actions = {
  rename: async ({ request, locals }) => {
    const user = requireUser(locals);
    const parsed = await parseFormWithKey(request, renameSchema, {
      field: 'passkeyErrorKey',
      badInputKey: 'errorsAccountPasskeyNameInvalid'
    });
    if (!parsed.ok) return parsed.failure;
    if (!(await renamePasskey(user.id, parsed.data.id, parsed.data.name))) {
      return fail(404, { passkeyErrorKey: 'errorsAccountPasskeyNotFound' });
    }
    audit({ type: 'account.passkey_renamed', userId: user.id, passkeyId: parsed.data.id });
    return { passkeySuccessKey: 'errorsAccountPasskeyRenameSuccess' };
  },

  delete: async ({ request, locals }) => {
    const user = requireUser(locals);
    // Generic bad-input key: the schema now rejects both a missing id and a
    // missing currentPassword, so the old « Identifiant manquant » copy would
    // mislabel half the failures.
    const parsed = await parseFormWithKey(request, deleteSchema, {
      field: 'passkeyErrorKey',
      badInputKey: 'errorsAuthBadInput'
    });
    if (!parsed.ok) return parsed.failure;
    // Fresh-auth parity with ADDING a passkey (registration/options requires
    // the current password): a stolen session cookie alone must not be able
    // to silently remove the owner's passkeys — deleting one locks that
    // device out of passwordless login and is the classic prelude to an
    // account takeover cleanup.
    const fresh = await requireFreshAuthWithKey(user, parsed.data.currentPassword, {
      field: 'passkeyErrorKey',
      rateLimitedKey: 'errorsAuthRateLimited',
      incorrectKey: 'errorsAccountPasswordIncorrect',
      onMissingUser: () => {
        throw localizedRedirect(locals.locale, 303, '/login');
      }
    });
    if (!fresh.ok) return fresh.failure;
    if (!(await deletePasskey(user.id, parsed.data.id))) {
      return fail(404, { passkeyErrorKey: 'errorsAccountPasskeyNotFound' });
    }
    audit({ type: 'account.passkey_deleted', userId: user.id, passkeyId: parsed.data.id });
    return { passkeySuccessKey: 'errorsAccountPasskeyDeleteSuccess' };
  }
};
