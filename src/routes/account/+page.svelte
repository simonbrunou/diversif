<script lang="ts">
  import ProfilBento from '$lib/components/bento/ProfilBento.svelte';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Card from '$components/ui/Card.svelte';
  import ThemeToggle from '$components/ThemeToggle.svelte';
  import LegalLinks from '$lib/components/LegalLinks.svelte';
  import { enhance } from '$app/forms';
  import { invalidateAll } from '$app/navigation';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';
  import { languageTag } from '$lib/paraglide/runtime';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let passkeyName = $state('');
  let registering = $state(false);
  let supported = $state(false);
  let confirmDeleteEmail = $state('');
  let confirmDeletePassword = $state('');
  let savingProfile = $state(false);
  let changingPassword = $state(false);
  let deletingAccount = $state(false);

  function trackSubmission(setter: (b: boolean) => void) {
    return () => {
      setter(true);
      return async ({ update }: { update: () => Promise<void> }) => {
        await update();
        setter(false);
      };
    };
  }

  $effect(() => {
    if (!browser) return;
    supported =
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential === 'function' &&
      typeof navigator.credentials?.create === 'function';
  });

  // Toast each form action result exactly once. Without this, any subsequent
  // re-render that reads `form` (e.g. the same object surviving a passkey
  // rename triggering a passkey-list update) would re-fire stale toasts.
  function resolveKey(key: string): string {
    const fn = m[key as keyof typeof m] as (() => string) | undefined;
    return fn?.() ?? /* v8 ignore next */ m.errorsGenericFallback();
  }

  let lastFormSeen: typeof form;
  $effect(() => {
    if (form === lastFormSeen) return;
    lastFormSeen = form;
    if (!form) return;
    if (form.profileSuccessKey) toast.success(resolveKey(form.profileSuccessKey));
    if (form.profileErrorKey) toast.error(resolveKey(form.profileErrorKey));
    if (form.passwordSuccessKey) toast.success(resolveKey(form.passwordSuccessKey));
    if (form.passwordErrorKey) toast.error(resolveKey(form.passwordErrorKey));
    if (form.passkeySuccessKey) toast.success(resolveKey(form.passkeySuccessKey));
    if (form.passkeyErrorKey) toast.error(resolveKey(form.passkeyErrorKey));
    if (form.deleteErrorKey) toast.error(resolveKey(form.deleteErrorKey));
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
      if (!optsRes.ok) throw new Error(`Impossible de démarrer l'enregistrement.`);
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
        toast.error(data?.error ?? 'Enregistrement échoué.');
        return;
      }
      passkeyName = '';
      toast.success(m.authAccountPasskeyRegisterSuccess());
      await invalidateAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur';
      // User cancellation surfaces as a NotAllowedError. Stay quiet for it.
      if (!/NotAllowedError|cancel/i.test(message)) {
        toast.error(message);
      }
    } finally {
      registering = false;
    }
  }
</script>

{#if data.bento}
  <ProfilBento
    children={data.children}
    passkeyCount={data.passkeys.length}
    locale={data.locale}
    theme={data.theme}
  />
{:else}
<div class="container max-w-2xl space-y-6 py-6">
  <header>
    <a href={localizedHref('/')} class="text-sm text-muted-foreground hover:underline">{m.authAccountBack()}</a>
    <h1 class="mt-2 text-xl font-semibold">{m.authAccountHeading()}</h1>
    {#if data.user}
      <p class="text-sm text-muted-foreground">{data.user.email}</p>
    {/if}
  </header>

  <Card class="p-4">
    <h2 class="text-base font-semibold">{m.authAccountProfileSection()}</h2>
    <form
      method="POST"
      action="?/updateProfile"
      class="mt-3 grid gap-3"
      use:enhance={trackSubmission((v) => (savingProfile = v))}
    >
      <div class="grid gap-1.5">
        <Label for="displayName">{m.authAccountDisplayNameLabel()}</Label>
        <Input id="displayName" name="displayName" required maxlength={80} value={data.user?.displayName ?? ''} />
      </div>
      <div>
        <Button type="submit" loading={savingProfile}>
          {savingProfile ? m.authAccountSaving() : m.authAccountSave()}
        </Button>
      </div>
    </form>
  </Card>

  <Card class="p-4">
    <h2 class="text-base font-semibold">{m.authAccountPasswordSection()}</h2>
    <form
      method="POST"
      action="?/changePassword"
      class="mt-3 grid gap-3"
      use:enhance={trackSubmission((v) => (changingPassword = v))}
    >
      <div class="grid gap-1.5">
        <Label for="currentPassword">{m.authAccountCurrentPasswordLabel()}</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required autocomplete="current-password" />
      </div>
      <div class="grid gap-1.5">
        <Label for="newPassword">{m.authAccountNewPasswordLabel()}</Label>
        <Input id="newPassword" name="newPassword" type="password" required minlength={12} autocomplete="new-password" />
      </div>
      <div>
        <Button type="submit" loading={changingPassword}>
          {changingPassword ? m.authAccountPasswordChanging() : m.authAccountPasswordChange()}
        </Button>
      </div>
    </form>
  </Card>

  <Card class="p-4">
    <h2 class="text-base font-semibold">{m.authAccountPasskeysSection()}</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      {m.authAccountPasskeysDescription()}
    </p>

    {#if data.passkeys.length === 0}
      <p class="mt-3 text-sm text-muted-foreground">{m.authAccountPasskeysEmpty()}</p>
    {:else}
      <ul class="mt-3 grid gap-2">
        {#each data.passkeys as p (p.id)}
          <li class="rounded-md border border-border p-3">
            <form method="POST" action="?/renamePasskey" class="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <Input
                name="name"
                value={p.name}
                maxlength={80}
                class="w-full sm:flex-1"
                aria-label={m.authAccountPasskeyNameLabel()}
              />
              <Button type="submit" size="sm" variant="outline">{m.authAccountPasskeyRenameButton()}</Button>
            </form>
            <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {m.authAccountPasskeyAddedOn()} {formatDate(p.createdAt)}{#if p.lastUsedAt} {m.authAccountPasskeyLastUsed()} {formatDate(p.lastUsedAt)}{/if}
                {#if p.backedUp} {m.authAccountPasskeySynced()}{/if}
              </span>
              <form method="POST" action="?/deletePasskey">
                <input type="hidden" name="id" value={p.id} />
                <Button type="submit" size="sm" variant="destructive">{m.authAccountPasskeyDeleteButton()}</Button>
              </form>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    {#if supported}
      <div class="mt-4 grid gap-3 border-t border-border pt-4">
        <div class="grid gap-1.5">
          <Label for="passkeyName">{m.authAccountPasskeyNewNameLabel()}</Label>
          <Input
            id="passkeyName"
            placeholder="iPhone, MacBook…"
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
      <p class="mt-4 text-sm text-muted-foreground">
        {m.authAccountPasskeyUnsupported()}
      </p>
    {/if}
  </Card>

  <Card class="p-4">
    <h2 class="text-base font-semibold">{m.authAccountAppearanceSection()}</h2>
    <p class="mt-1 text-sm text-muted-foreground">{m.authAccountAppearanceDescription()}</p>
    <div class="mt-3">
      <ThemeToggle />
    </div>
  </Card>

  <Card class="p-4">
    <h2 class="text-base font-semibold">{m.authAccountSessionsSection()}</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      {m.authAccountSessionsDescription()}
    </p>
    <form method="POST" action="?/logoutEverywhere" class="mt-3">
      <Button type="submit" variant="outline">{m.authAccountLogoutEverywhere()}</Button>
    </form>
  </Card>

  <Card class="p-4">
    <h2 class="text-base font-semibold">{m.authAccountLogoutSection()}</h2>
    <form method="POST" action="/logout" class="mt-3">
      <Button type="submit" variant="outline">{m.authAccountLogout()}</Button>
    </form>
  </Card>

  <Card class="p-4">
    <h2 class="text-base font-semibold">{m.authAccountDataSection()}</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      {m.authAccountDataDescription()}
    </p>
    <div class="mt-3">
      <Button href={localizedHref('/account/export')} variant="outline">{m.authAccountDataExport()}</Button>
    </div>
  </Card>

  <Card class="p-4 border-destructive/30">
    <h2 class="text-base font-semibold text-destructive">{m.authAccountDeleteSection()}</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      {m.authAccountDeleteDescription()}
    </p>
    <form
      method="POST"
      action="?/deleteAccount"
      class="mt-3 grid gap-3"
      use:enhance={trackSubmission((v) => (deletingAccount = v))}
    >
      <div class="grid gap-1.5">
        <Label for="confirmEmail">{m.authAccountDeleteConfirmLabel()}</Label>
        <Input
          id="confirmEmail"
          name="confirmEmail"
          type="email"
          autocomplete="off"
          bind:value={confirmDeleteEmail}
          placeholder={data.user?.email ?? ''}
          required
        />
      </div>
      <div class="grid gap-1.5">
        <Label for="deletePassword">{m.authAccountDeletePasswordLabel()}</Label>
        <Input
          id="deletePassword"
          name="currentPassword"
          type="password"
          autocomplete="current-password"
          bind:value={confirmDeletePassword}
          required
        />
      </div>
      <div>
        <Button
          type="submit"
          variant="destructive"
          loading={deletingAccount}
          disabled={confirmDeleteEmail.trim().toLowerCase() !== (data.user?.email ?? '') ||
            confirmDeletePassword.length === 0}
        >
          {deletingAccount ? m.authAccountDeleteSubmitting() : m.authAccountDeleteSubmit()}
        </Button>
      </div>
    </form>
  </Card>

  <Card class="p-4">
    <h2 class="text-base font-semibold">{m.authAccountLegalSection()}</h2>
    <div class="mt-3">
      <LegalLinks />
    </div>
  </Card>
</div>
{/if}
