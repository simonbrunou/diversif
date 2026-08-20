<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Field from '$lib/components/ui/Field.svelte';
  import BentoAuthLayout from '$lib/components/bento/BentoAuthLayout.svelte';
  import FormError from '$components/ui/FormError.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { Eye, EyeOff } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
  import { signInWithPasskey } from '$lib/auth/passkey-client';
  import { trackSubmission } from '$lib/forms/tracked-enhance';
  import { localizedHref } from '$lib/utils/localized-href';
  import { PASSWORD_MIN_LENGTH } from '$lib/utils/password';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let submitting = $state(false);
  let showPassword = $state(false);
  let passkeyLoading = $state(false);
  // bind:value (state seeded from the failure echo) instead of one-way value
  // attributes — Svelte re-applies plain value attributes on any re-render
  // of the element, wiping in-progress typing when `form`/`data` settle late
  // (see OnboardingForm for the full story).
  // Seed-once is the point: later prop changes must NOT overwrite what
  // the user is typing.
  // svelte-ignore state_referenced_locally
  let displayName = $state(form?.displayName ?? '');
  // svelte-ignore state_referenced_locally
  let email = $state(form?.email ?? '');
  // svelte-ignore state_referenced_locally
  let inviteCode = $state(form?.inviteCode ?? data.inviteCode);
  const passkeyUnsupported = $derived(
    browser &&
      !(
        typeof window.PublicKeyCredential === 'function' &&
        typeof navigator.credentials?.get === 'function'
      )
  );

  async function passkeySignIn() {
    if (passkeyLoading) return;
    await signInWithPasskey((v) => (passkeyLoading = v));
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
    use:enhance={trackSubmission((v) => (submitting = v))}
  >
    {#if form?.errorKey}
      {@const k = form.errorKey as keyof typeof m}
      <FormError>
        {(m[k] as (() => string) | undefined)?.() ?? /* v8 ignore next */ m.errorsGenericFallback()}
      </FormError>
    {/if}

    <Field name="displayName" label={m.authSignupDisplayNameLabel()}>
      <Input
        id="displayName"
        name="displayName"
        autocomplete="given-name"
        required
        maxlength={80}
        bind:value={displayName}
      />
    </Field>

    <Field name="email" label={m.authEmailLabel()}>
      <Input
        id="email"
        name="email"
        type="email"
        autocomplete="email"
        required
        bind:value={email}
      />
    </Field>

    <Field name="password" label={m.authPasswordLabel()} hint={m.authSignupPasswordHint()}>
      <div class="relative">
        <Input
          id="password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autocomplete="new-password"
          required
          minlength={PASSWORD_MIN_LENGTH}
          class="pr-12"
        />
        <button
          type="button"
          onclick={() => (showPassword = !showPassword)}
          aria-label={showPassword ? m.authSignupPasswordHide() : m.authSignupPasswordShow()}
          aria-pressed={showPassword}
          class="tap-target absolute right-0 top-1/2 flex -translate-y-1/2 items-center justify-center rounded text-ink-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {#if showPassword}
            <EyeOff size={18} aria-hidden="true" />
          {:else}
            <Eye size={18} aria-hidden="true" />
          {/if}
        </button>
      </div>
    </Field>

    <Field name="inviteCode" label={m.authSignupInviteCodeLabel()}>
      <Input
        id="inviteCode"
        name="inviteCode"
        placeholder="BEBE-XXXXXX"
        bind:value={inviteCode}
        autocomplete="off"
      />
    </Field>

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
      onclick={passkeySignIn}
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
