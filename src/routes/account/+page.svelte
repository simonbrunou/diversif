<script lang="ts">
  import ProfilBento from '$lib/components/bento/ProfilBento.svelte';
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import ThemeToggle from '$components/ThemeToggle.svelte';
  import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
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
  let unsupported = $state(false);
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
    unsupported = !(
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential === 'function' &&
      typeof navigator.credentials?.create === 'function'
    );
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

<ProfilBento
  children={data.children}
  passkeyCount={data.passkeys.length}
  locale={data.locale}
  theme={data.theme}
/>

<div class="container max-w-2xl space-y-8 py-6">
  <section aria-labelledby="group-identity" class="space-y-3">
    <h2 id="group-identity" class="font-display text-xl italic leading-tight">
      {m.authAccountGroupIdentity()}
    </h2>

    <section class="rounded-tile bg-surface px-4 py-3 shadow-soft">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
        {m.authAccountProfileSection()}
      </h3>
      <form
        method="POST"
        action="?/updateProfile"
        class="grid gap-3"
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
    </section>

    <section id="password" class="scroll-mt-20 rounded-tile bg-surface px-4 py-3 shadow-soft">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
        {m.authAccountPasswordSection()}
      </h3>
      <form
        method="POST"
        action="?/changePassword"
        class="grid gap-3"
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
    </section>

    <section id="passkeys" class="scroll-mt-20 rounded-tile bg-surface px-4 py-3 shadow-soft">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
        {m.authAccountPasskeysSection()}
      </h3>
      <p class="mb-3 text-sm text-ink-soft">
        {m.authAccountPasskeysDescription()}
      </p>

      {#if data.passkeys.length === 0}
        <p class="text-sm text-ink-soft">{m.authAccountPasskeysEmpty()}</p>
      {:else}
        <ul class="grid gap-2">
          {#each data.passkeys as p (p.id)}
            <li class="rounded-tile bg-canvas px-3 py-2 shadow-soft">
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
              <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
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

      {#if !unsupported}
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
        <p class="mt-4 text-sm text-ink-soft">
          {m.authAccountPasskeyUnsupported()}
        </p>
      {/if}
    </section>
  </section>

  <section aria-labelledby="group-preferences" class="space-y-3">
    <h2 id="group-preferences" class="font-display text-xl italic leading-tight">
      {m.authAccountGroupPreferences()}
    </h2>

    <section id="theme" class="scroll-mt-20 rounded-tile bg-surface px-4 py-3 shadow-soft">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
        {m.authAccountAppearanceSection()}
      </h3>
      <p class="mb-3 text-sm text-ink-soft">{m.authAccountAppearanceDescription()}</p>
      <ThemeToggle />
    </section>

    <section id="locale" class="scroll-mt-20 rounded-tile bg-surface px-4 py-3 shadow-soft">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
        {m.profilCompteLangue()}
      </h3>
      <LocaleSwitcher />
    </section>
  </section>

  <section aria-labelledby="group-sessions" class="space-y-3">
    <h2 id="group-sessions" class="font-display text-xl italic leading-tight">
      {m.authAccountGroupSessions()}
    </h2>

    <section class="rounded-tile bg-surface px-4 py-3 shadow-soft">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
        {m.authAccountSessionsSection()}
      </h3>
      <p class="mb-3 text-sm text-ink-soft">
        {m.authAccountSessionsDescription()}
      </p>
      <form method="POST" action="?/logoutEverywhere">
        <Button type="submit" variant="outline">{m.authAccountLogoutEverywhere()}</Button>
      </form>
    </section>

    <section class="rounded-tile bg-surface px-4 py-3 shadow-soft">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
        {m.authAccountLogoutSection()}
      </h3>
      <form method="POST" action="/logout">
        <Button type="submit" variant="outline">{m.authAccountLogout()}</Button>
      </form>
    </section>
  </section>

  <section aria-labelledby="group-data" class="space-y-3">
    <h2 id="group-data" class="font-display text-xl italic leading-tight">
      {m.authAccountGroupData()}
    </h2>

    <section class="rounded-tile bg-surface px-4 py-3 shadow-soft">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
        {m.authAccountDataSection()}
      </h3>
      <p class="mb-3 text-sm text-ink-soft">
        {m.authAccountDataDescription()}
      </p>
      <Button href={localizedHref('/account/export')} variant="outline">{m.authAccountDataExport()}</Button>
    </section>

    <section id="delete" class="scroll-mt-20 rounded-tile bg-tile-butter px-4 py-3 shadow-soft">
      <h3 class="mb-2 text-sm font-semibold uppercase tracking-wider text-destructive">
        {m.authAccountDeleteSection()}
      </h3>
      <p class="mb-3 text-sm text-ink-soft">
        {m.authAccountDeleteDescription()}
      </p>
      <form
        method="POST"
        action="?/deleteAccount"
        class="grid gap-3"
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
    </section>
  </section>

  <section class="rounded-tile bg-surface px-4 py-3 shadow-soft">
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
      {m.authAccountLegalSection()}
    </h2>
    <LegalLinks />
  </section>
</div>
