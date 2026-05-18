<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import BentoAuthLayout from '$lib/components/bento/BentoAuthLayout.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import { Eye, EyeOff } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let submitting = $state(false);
  let showPassword = $state(false);
  let passkeyLoading = $state(false);
  let passkeyUnsupported = $state(false);

  $effect(() => {
    if (!browser) return;
    passkeyUnsupported = !(
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential === 'function' &&
      typeof navigator.credentials?.get === 'function'
    );
  });

  async function signInWithPasskey() {
    if (passkeyLoading) return;
    passkeyLoading = true;
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const optsRes = await fetch('/passkeys/authentication/options', { method: 'POST' });
      if (!optsRes.ok) throw new Error(m.errorsAccountPasskeyAuthStartFailed());
      const optsJSON = await optsRes.json();
      const assertion = await startAuthentication({ optionsJSON: optsJSON });
      const verifyRes = await fetch('/passkeys/authentication/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response: assertion })
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !data?.ok) {
        toast.error(data?.error ?? m.errorsAccountPasskeyAuthFailed());
        return;
      }
      await goto('/', { invalidateAll: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : m.errorsAccountPasskeyGenericError();
      if (!/NotAllowedError|cancel/i.test(message)) {
        toast.error(message);
      }
    } finally {
      passkeyLoading = false;
    }
  }
</script>

<Seo title={m.authSignupTitle()} path="/signup" noindex alternateLocales={['en']} />

<BentoAuthLayout
  title={m.authSignupTitleBento()}
  subtitle={data.inviteCode ? m.authSignupSubheadingInvited() : m.authSignupSubtitleBento()}
>
  <form
    method="POST"
    class="grid gap-4"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update();
        submitting = false;
      };
    }}
  >
    {#if form?.errorKey}
      {@const k = form.errorKey as keyof typeof m}
      <div class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {(m[k] as (() => string) | undefined)?.() ?? /* v8 ignore next */ m.errorsGenericFallback()}
      </div>
    {/if}

    <div class="grid gap-1.5">
      <Label for="displayName">{m.authSignupDisplayNameLabel()}</Label>
      <Input
        id="displayName"
        name="displayName"
        autocomplete="given-name"
        required
        maxlength={80}
        value={form?.displayName ?? ''}
      />
    </div>

    <div class="grid gap-1.5">
      <Label for="email">{m.authSignupEmailLabel()}</Label>
      <Input
        id="email"
        name="email"
        type="email"
        autocomplete="email"
        required
        value={form?.email ?? ''}
      />
    </div>

    <div class="grid gap-1.5">
      <Label for="password">{m.authSignupPasswordLabel()}</Label>
      <div class="relative">
        <Input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autocomplete="new-password"
          required
          minlength={12}
          class="pr-12"
        />
        <button
          type="button"
          onclick={() => (showPassword = !showPassword)}
          aria-label={showPassword ? m.authSignupPasswordHide() : m.authSignupPasswordShow()}
          aria-pressed={showPassword}
          class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-2 text-ink-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {#if showPassword}
            <EyeOff size={18} aria-hidden="true" />
          {:else}
            <Eye size={18} aria-hidden="true" />
          {/if}
        </button>
      </div>
      <p class="text-xs text-muted-foreground">{m.authSignupPasswordHint()}</p>
    </div>

    <div class="grid gap-1.5">
      <Label for="inviteCode">{m.authSignupInviteCodeLabel()}</Label>
      <Input
        id="inviteCode"
        name="inviteCode"
        placeholder="BEBE-XXXXXX"
        value={form?.inviteCode ?? data.inviteCode}
        autocomplete="off"
      />
    </div>

    <div class="grid gap-2 rounded-md border bg-surface/50 p-3 text-sm">
      <label class="flex items-start gap-2">
        <input type="checkbox" name="confirmAge15" required class="mt-0.5" />
        <span>{m.authSignupAge15()}</span>
      </label>
      <label class="flex items-start gap-2">
        <input type="checkbox" name="acceptTos" required class="mt-0.5" />
        <span>
          {m.authSignupAcceptTosPrefix()}
          <a href={localizedHref('/cgu')} target="_blank" rel="noopener" class="underline">{m.authSignupAcceptTosLink()}</a>.
        </span>
      </label>
      <label class="flex items-start gap-2">
        <input type="checkbox" name="acceptPrivacy" required class="mt-0.5" />
        <span>
          {m.authSignupAcceptPrivacyPrefix()}
          <a href={localizedHref('/politique-confidentialite')} target="_blank" rel="noopener" class="underline">{m.authSignupAcceptPrivacyLink()}</a>
          {m.authSignupAcceptPrivacySuffix()}
        </span>
      </label>
    </div>

    <Button type="submit" size="lg" loading={submitting}>
      {submitting ? m.authSignupSubmitting() : m.authSignupSubmit()}
    </Button>
  </form>

  {#if !passkeyUnsupported}
    <div class="mt-4 text-center text-xs uppercase tracking-wider text-ink-soft">
      {m.authSignupDivider()}
    </div>

    <button
      type="button"
      onclick={signInWithPasskey}
      disabled={passkeyLoading}
      class="mt-4 block w-full rounded-full border border-dashed border-primary px-4 py-3 text-center text-sm font-bold text-primary-strong disabled:opacity-60"
    >
      {passkeyLoading ? m.authLoginPasskeyLoading() : m.authSignupPasskeyCta()}
    </button>
  {/if}

  <a href={localizedHref('/login')} class="mt-4 block text-center text-sm text-primary-strong underline">
    {m.authSignupFooterLogin()}
  </a>
</BentoAuthLayout>
