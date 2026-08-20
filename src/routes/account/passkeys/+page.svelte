<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import ConfirmModal from '$lib/components/ui/ConfirmModal.svelte';
  import Input from '$components/ui/Input.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import { invalidateAll } from '$app/navigation';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { createFormToasts } from '$lib/forms/form-toasts.svelte';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

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

  // ConfirmModal self-closes on success results (trackSubmission onSuccess),
  // so the delete modal needs no manual dismissal here.
  createFormToasts(() => form, { successKey: 'passkeySuccessKey', errorKey: 'passkeyErrorKey' });

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
      if (!optsRes.ok || optsJSON?.ok === false) {
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
      await invalidateAll();
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
      <Field name="currentPassword" label={m.commonPassword()}>
        <Input
          id="currentPassword"
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
/>
