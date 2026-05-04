<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Card from '$components/ui/Card.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import { enhance } from '$app/forms';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
  let submitting = $state(false);
  let passkeyLoading = $state(false);
  let supported = $state(false);

  $effect(() => {
    if (!browser) return;
    supported =
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential === 'function' &&
      typeof navigator.credentials?.get === 'function';
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

<Seo title="Connexion · Diversif" path="/login" noindex />

<div class="container flex max-w-md flex-1 flex-col justify-center py-10">
  <div class="text-center">
    <h1 class="text-3xl font-semibold">Diversif</h1>
    <p class="mt-2 text-sm text-muted-foreground">Connexion</p>
  </div>

  <Card class="mt-8 p-6">
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
      {#if form?.error}
        <div class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {form.error}
        </div>
      {/if}

      <div class="grid gap-1.5">
        <Label for="email">Email</Label>
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
        <Label for="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autocomplete="current-password webauthn"
          required
        />
      </div>

      <Button type="submit" size="lg" loading={submitting}>
        {submitting ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>

    {#if supported}
      <div class="mt-4 flex items-center gap-2 text-xs uppercase text-muted-foreground">
        <span class="h-px flex-1 bg-border"></span>
        <span>ou</span>
        <span class="h-px flex-1 bg-border"></span>
      </div>
      <Button
        type="button"
        size="lg"
        variant="outline"
        class="mt-4 w-full"
        loading={passkeyLoading}
        onclick={signInWithPasskey}
      >
        {passkeyLoading ? 'Connexion…' : 'Se connecter avec une clé d’accès'}
      </Button>
    {/if}
  </Card>

  <p class="mt-6 text-center text-sm text-muted-foreground">
    Pas encore de compte ? <a href="/signup" class="font-medium text-primary hover:underline">Créer un compte</a>
  </p>
</div>
