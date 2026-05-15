<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import { invalidateAll } from '$app/navigation';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';
  import { languageTag } from '$lib/paraglide/runtime';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let passkeyName = $state('');
  let registering = $state(false);
  let unsupported = $state(false);

  $effect(() => {
    if (!browser) return;
    unsupported = !(
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential === 'function' &&
      typeof navigator.credentials?.create === 'function'
    );
  });

  function resolveKey(key: string): string {
    const fn = m[key as keyof typeof m] as (() => string) | undefined;
    return fn?.() ?? /* v8 ignore next */ m.errorsGenericFallback();
  }

  let lastFormSeen: typeof form;
  $effect(() => {
    if (form === lastFormSeen) return;
    lastFormSeen = form;
    if (!form) return;
    if (form.passkeySuccessKey) toast.success(resolveKey(form.passkeySuccessKey));
    if (form.passkeyErrorKey) toast.error(resolveKey(form.passkeyErrorKey));
  });

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString(languageTag() === 'en' ? 'en-GB' : 'fr-FR', {
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
      const optsRes = await fetch('/passkeys/registration/options', { method: 'POST' });
      if (!optsRes.ok) throw new Error(m.errorsAccountPasskeyRegisterStartFailed());
      const optsJSON = await optsRes.json();
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
        toast.error(data?.error ?? m.errorsAccountPasskeyRegisterFailed());
        return;
      }
      passkeyName = '';
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
            <form method="POST" action="?/delete">
              <input type="hidden" name="id" value={p.id} />
              <Button type="submit" size="sm" variant="destructive">
                {m.authAccountPasskeyDeleteButton()}
              </Button>
            </form>
          </div>
        </li>
      {/each}
    </ul>
  {/if}

  {#if !unsupported}
    <div class="grid gap-3 border-t border-border pt-4">
      <div class="grid gap-1.5">
        <Label for="passkeyName">{m.authAccountPasskeyNewNameLabel()}</Label>
        <Input
          id="passkeyName"
          placeholder={m.authAccountPasskeyNamePlaceholder()}
          maxlength={80}
          bind:value={passkeyName}
        />
      </div>
      <div>
        <Button type="button" onclick={registerPasskey} loading={registering}>
          {registering ? m.authAccountPasskeyAdding() : m.authAccountPasskeyAdd()}
        </Button>
      </div>
    </div>
  {:else}
    <p class="text-sm text-ink-soft">{m.authAccountPasskeyUnsupported()}</p>
  {/if}
</div>
