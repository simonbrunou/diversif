<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Card from '$components/ui/Card.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
  let submitting = $state(false);
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
          autocomplete="email"
          required
          value={form?.email ?? ''}
        />
      </div>

      <div class="grid gap-1.5">
        <Label for="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" autocomplete="current-password" required />
      </div>

      <Button type="submit" size="lg" loading={submitting}>
        {submitting ? 'Connexion…' : 'Se connecter'}
      </Button>
    </form>
  </Card>

  <p class="mt-6 text-center text-sm text-muted-foreground">
    Pas encore de compte ? <a href="/signup" class="font-medium text-primary hover:underline">Créer un compte</a>
  </p>
</div>
