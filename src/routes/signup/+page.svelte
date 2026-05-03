<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Card from '$components/ui/Card.svelte';
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let submitting = $state(false);
</script>

<div class="container flex max-w-md flex-1 flex-col justify-center py-10">
  <div class="text-center">
    <h1 class="text-3xl font-semibold">Créer un compte</h1>
    <p class="mt-2 text-sm text-muted-foreground">
      {data.inviteCode ? 'Vous avez été invité·e à rejoindre un enfant.' : 'Suivez la diversification de votre enfant.'}
    </p>
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
        <Label for="displayName">Votre prénom</Label>
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
        <Input id="password" name="password" type="password" autocomplete="new-password" required minlength={12} />
        <p class="text-xs text-muted-foreground">12 caractères minimum.</p>
      </div>

      <div class="grid gap-1.5">
        <Label for="inviteCode">Code d’invitation (optionnel)</Label>
        <Input
          id="inviteCode"
          name="inviteCode"
          placeholder="BEBE-XXXX"
          value={form?.inviteCode ?? data.inviteCode}
          autocomplete="off"
        />
      </div>

      <Button type="submit" size="lg" loading={submitting}>
        {submitting ? 'Création…' : 'Créer mon compte'}
      </Button>
    </form>
  </Card>

  <p class="mt-6 text-center text-sm text-muted-foreground">
    Déjà un compte ? <a href="/login" class="font-medium text-primary hover:underline">Se connecter</a>
  </p>
</div>
