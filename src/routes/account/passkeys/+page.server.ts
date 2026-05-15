import { fail } from '@sveltejs/kit';
import { deletePasskey, listPasskeys, publicPasskey, renamePasskey } from '$lib/server/passkeys';
import { requireUser } from '$lib/server/guards';
import { audit } from '$lib/server/audit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = requireUser(locals);
  const passkeys = (await listPasskeys(user.id)).map(publicPasskey);
  return { passkeys };
};

export const actions: Actions = {
  rename: async ({ request, locals }) => {
    const user = requireUser(locals);
    const raw = Object.fromEntries(await request.formData());
    const id = typeof raw.id === 'string' ? raw.id : /* v8 ignore next */ '';
    const name = typeof raw.name === 'string' ? raw.name : /* v8 ignore next */ '';
    if (!id || !name.trim()) {
      return fail(400, { passkeyErrorKey: 'errorsAccountPasskeyNameInvalid' });
    }
    if (!(await renamePasskey(user.id, id, name))) {
      return fail(404, { passkeyErrorKey: 'errorsAccountPasskeyNotFound' });
    }
    audit({ type: 'account.passkey_renamed', userId: user.id, passkeyId: id });
    return { passkeySuccessKey: 'errorsAccountPasskeyRenameSuccess' };
  },

  delete: async ({ request, locals }) => {
    const user = requireUser(locals);
    const raw = Object.fromEntries(await request.formData());
    const id = typeof raw.id === 'string' ? raw.id : /* v8 ignore next */ '';
    if (!id) {
      return fail(400, { passkeyErrorKey: 'errorsAccountPasskeyIdMissing' });
    }
    if (!(await deletePasskey(user.id, id))) {
      return fail(404, { passkeyErrorKey: 'errorsAccountPasskeyNotFound' });
    }
    audit({ type: 'account.passkey_deleted', userId: user.id, passkeyId: id });
    return { passkeySuccessKey: 'errorsAccountPasskeyDeleteSuccess' };
  }
};
