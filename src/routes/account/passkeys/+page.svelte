<script lang="ts">
  import BackHeader from '#lib/components/ui/BackHeader.svelte';
  import Button from '#lib/components/ui/Button.svelte';
  import ConfirmModal from '#lib/components/ui/ConfirmModal.svelte';
  import Input from '#lib/components/ui/Input.svelte';
  import Field from '#lib/components/ui/Field.svelte';
  import FormError from '#lib/components/ui/FormError.svelte';
  import FormSuccess from '#lib/components/ui/FormSuccess.svelte';
  import { refreshAll } from '$app/navigation';
  import { browser } from '$app/env';
  import { untrack } from 'svelte';
  import { toast } from 'svelte-sonner';
  import * as m from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';
  import { resolveMessageKey } from '#lib/forms/tracked-enhance.js';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Rename posts without use:enhance, so its result always comes with a page
  // load, JavaScript or not: the page shows the refusal it loaded with. Delete
  // posts from the enhanced ConfirmModal, which applies the result in place
  // and stays open on a refusal, so that refusal shows inside the dialog
  // instead of behind it. A success shows on the page either way: the dialog
  // has closed by then.
  const loadedForm = untrack(() => form);
  const pageLoadResult = $derived(form === loadedForm ? form : null);
  const deleteFailureMessage = $derived(
    form !== loadedForm && form?.passkeyErrorKey
      ? resolveMessageKey(form.passkeyErrorKey)
      : m.errorsGenericFallback()
  );

  let passkeyName = $state('');
  let currentPassword = $state('');
  let registering = $state(false);
  // Deleting a key is destructive (the device loses passwordless login) and
  // fresh-auth-gated server-side, so the button opens a ConfirmModal that
  // collects the current password instead of submitting directly.
  let deleteOpen = $state(false);
  let deleteTargetId = $state('');

  function askDeletePasskey(id: string) {
    deleteTargetId = id;
    deleteOpen = true;
  }
  const unsupported = $derived(
    browser &&
      !(
        typeof window.PublicKeyCredential === 'function' &&
        typeof navigator.credentials?.create === 'function'
      )
  );

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(getLocale() === 'en' ? 'en-GB' : 'fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  async function registerPasskey() {
    if (registering) return;
    registering = true;
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const optsRes = await fetch('/passkeys/registration/options', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword })
      });
      const optsJSON = await optsRes.json().catch(() => ({}));
      // `redirected`: a signed-out request is sent to /login, and fetch
      // follows it to an HTML 200 that must not reach the ceremony.
      if (!optsRes.ok || optsRes.redirected || optsJSON?.ok === false) {
        // The server's raw error string is deliberately ignored (same as the
        // login/signup passkey flow in passkey-client.ts): it isn't run
        // through paraglide, so the localized fallback is strictly better for
        // EN users.
        throw new Error(m.errorsAccountPasskeyRegisterStartFailed());
      }
      const attResp = await startRegistration({ optionsJSON: optsJSON });
      const verifyRes = await fetch('/passkeys/registration/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          response: attResp,
          name: passkeyName.trim() || 'Passkey'
        })
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !data?.ok) {
        // Same rationale as above: the server's raw string isn't localized.
        toast.error(m.errorsAccountPasskeyRegisterFailed());
        return;
      }
      passkeyName = '';
      currentPassword = '';
      toast.success(m.authAccountPasskeyRegisterSuccess());
      await refreshAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : m.errorsAccountPasskeyGenericError();
      // User cancellation surfaces as a NotAllowedError. Stay quiet for it.
      if (!/NotAllowedError|cancel/i.test(message)) {
        toast.error(message);
      }
    } finally {
      registering = false;
    }
  }
</script>

<BackHeader title={m.authAccountPasskeysSection()} />

<FormSuccess messageKey={form?.passkeySuccessKey} {form} class="mb-4" />
<FormError messageKey={pageLoadResult?.passkeyErrorKey} form={pageLoadResult} class="mb-4" />
<div class="space-y-4">
  <p class="text-sm text-ink-soft">{m.authAccountPasskeysDescription()}</p>

  {#if data.passkeys.length === 0}
    <p class="text-sm text-ink-soft">{m.authAccountPasskeysEmpty()}</p>
  {:else}
    <ul class="grid gap-2">
      {#each data.passkeys as p (p.id)}
        <li class="rounded-tile bg-canvas px-3 py-2 shadow-soft">
          <form method="POST" action="?/rename" class="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={p.id} />
            <Input
              name="name"
              value={p.name}
              maxlength={80}
              class="w-full sm:flex-1"
              aria-label={m.authAccountPasskeyNameLabel()}
            />
            <Button type="submit" size="sm" variant="outline">
              {m.authAccountPasskeyRenameButton()}
            </Button>
          </form>
          <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
            <span>
              {m.authAccountPasskeyAddedOn()} {formatDate(p.createdAt)}{#if p.lastUsedAt} {m.authAccountPasskeyLastUsed()} {formatDate(p.lastUsedAt)}{/if}
              {#if p.backedUp} {m.authAccountPasskeySynced()}{/if}
            </span>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onclick={() => askDeletePasskey(p.id)}
            >
              {m.authAccountPasskeyDeleteButton()}
            </Button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if !unsupported}
    <div class="grid gap-3 border-t border-border pt-4">
      <Field name="passkeyName" label={m.authAccountPasskeyNewNameLabel()}>
        <Input
          id="passkeyName"
          placeholder={m.authAccountPasskeyNamePlaceholder()}
          maxlength={80}
          bind:value={passkeyName}
        />
      </Field>
      <!-- Not `currentPassword`: the delete dialog's field has that id, and a
           duplicate would point the dialog's label at this field. -->
      <Field name="passkeyCurrentPassword" label={m.commonPassword()}>
        <Input
          id="passkeyCurrentPassword"
          type="password"
          autocomplete="current-password"
          bind:value={currentPassword}
          required
        />
      </Field>
      <div>
        <Button type="button" onclick={registerPasskey} loading={registering} disabled={!currentPassword}>
          {registering ? m.authAccountPasskeyAdding() : m.authAccountPasskeyAdd()}
        </Button>
      </div>
    </div>
  {:else}
    <p class="text-sm text-ink-soft">{m.authAccountPasskeyUnsupported()}</p>
  {/if}
</div>

<ConfirmModal
  bind:open={deleteOpen}
  title={m.authAccountPasskeyDeleteConfirmTitle()}
  description={m.authAccountPasskeyDeleteConfirmDescription()}
  action="?/delete"
  confirmLabel={m.authAccountPasskeyDeleteButton()}
  loadingLabel={m.authAccountPasskeyDeleting()}
  destructive
  requirePassword
  passwordLabel={m.authAccountPasskeyDeletePasswordLabel()}
  hiddenFields={{ id: deleteTargetId }}
  failureMessage={deleteFailureMessage}
/>
