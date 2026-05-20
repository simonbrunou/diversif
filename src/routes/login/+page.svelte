<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import BentoAuthLayout from '$lib/components/bento/BentoAuthLayout.svelte';
  import FormError from '$components/ui/FormError.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
  let submitting = $state(false);
  let passkeyLoading = $state(false);
  let unsupported = $state(false);

  $effect(() => {
    if (!browser) return;
    unsupported = !(
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential === 'function' &&
      typeof navigator.credentials?.get === 'function'
    );
  });

  // Conditional UI: pre-arms a passkey ceremony so the browser can offer
  // matching credentials inline with the email field's autofill dropdown.
  // Unsupported browsers silently fall back to the explicit passkey button.
  // Starting a modal ceremony (signInWithPasskey) auto-cancels this via
  // simplewebauthn's internal AbortService, so the two flows coexist safely.
  onMount(() => {
    if (!browser) return;
    let cancelled = false;
    let cancelCeremony: (() => void) | null = null;

    void (async () => {
      try {
        const mod = await import('@simplewebauthn/browser');
        cancelCeremony = () => mod.WebAuthnAbortService.cancelCeremony();
        if (cancelled) return;
        const supported = await mod.browserSupportsWebAuthnAutofill();
        if (!supported || cancelled) return;
        const optsRes = await fetch('/passkeys/authentication/options', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ mode: 'autofill' })
        });
        if (!optsRes.ok || cancelled) return;
        const optsJSON = await optsRes.json();
        if (cancelled) return;
        const assertion = await mod.startAuthentication({
          optionsJSON: optsJSON,
          useBrowserAutofill: true
        });
        if (cancelled) return;
        const verifyRes = await fetch('/passkeys/authentication/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ response: assertion })
        });
        if (cancelled) return;
        const data = await verifyRes.json().catch(() => ({}));
        if (cancelled) return;
        if (verifyRes.ok && data?.ok) {
          if (cancelled) return;
          await goto('/', { invalidateAll: true });
        }
      } catch {
        // Background flow: aborts, refusals, and network blips stay silent.
        // Users can still authenticate via the explicit passkey button or password.
      }
    })();

    return () => {
      cancelled = true;
      try {
        cancelCeremony?.();
      } catch {
        /* ignore */
      }
    };
  });

  async function signInWithPasskey() {
    if (passkeyLoading) return;
    passkeyLoading = true;
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const optsRes = await fetch('/passkeys/authentication/options', { method: 'POST' });
      if (!optsRes.ok) throw new Error('Impossible de démarrer la connexion.');
      const optsJSON = await optsRes.json();
      const assertion = await startAuthentication({ optionsJSON: optsJSON });
      const verifyRes = await fetch('/passkeys/authentication/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response: assertion })
      });
      const data = await verifyRes.json().catch(() => ({}));
      if (!verifyRes.ok || !data?.ok) {
        toast.error(data?.error ?? 'Connexion échouée.');
        return;
      }
      await goto('/', { invalidateAll: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur';
      if (!/NotAllowedError|cancel/i.test(message)) {
        toast.error(message);
      }
    } finally {
      passkeyLoading = false;
    }
  }
</script>

<Seo title={m.authLoginTitle()} path="/login" noindex alternateLocales={['en']} />

<BentoAuthLayout title={m.authLoginTitleBento()} subtitle="">
  {#if !unsupported}
    <button
      type="button"
      disabled={passkeyLoading}
      onclick={signInWithPasskey}
      class="w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-soft disabled:opacity-60"
    >
      {passkeyLoading ? m.authLoginPasskeyLoading() : m.authLoginPasskeyPrimaryCta()}
    </button>
    <div class="my-4 text-center text-xs uppercase tracking-wider text-ink-soft">
      {m.authLoginPasswordReveal()}
    </div>
  {/if}

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
      <FormError>
        {(m[k] as (() => string) | undefined)?.() ?? /* v8 ignore next */ m.errorsGenericFallback()}
      </FormError>
    {/if}

    <div class="grid gap-1.5">
      <Label for="email">{m.authEmailLabel()}</Label>
      <Input
        id="email"
        name="email"
        type="email"
        autocomplete="email webauthn"
        required
        value={form?.email ?? ''}
      />
    </div>

    <div class="grid gap-1.5">
      <Label for="password">{m.authPasswordLabel()}</Label>
      <Input
        id="password"
        name="password"
        type="password"
        autocomplete="current-password webauthn"
        required
      />
    </div>

    <Button type="submit" size="lg" loading={submitting}>
      {submitting ? m.authLoginSubmitting() : m.authLoginSubmit()}
    </Button>
  </form>

  {#if unsupported}
    <button
      type="button"
      onclick={signInWithPasskey}
      disabled={passkeyLoading}
      class="mt-4 w-full rounded-full border border-dashed border-primary px-4 py-3 text-sm font-bold text-primary-strong disabled:opacity-60"
    >
      {passkeyLoading ? m.authLoginPasskeyLoading() : m.authLoginPasskeySecondary()}
    </button>
  {/if}

  <a href={localizedHref('/signup')} class="mt-4 block text-center text-sm text-primary-strong underline">
    {m.authLoginFooterSignup()}
  </a>
</BentoAuthLayout>
