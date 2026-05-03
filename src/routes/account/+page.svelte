<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Card from '$components/ui/Card.svelte';
  import ThemeToggle from '$components/ThemeToggle.svelte';
  import { toast } from 'svelte-sonner';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  $effect(() => {
    if (form?.profileSuccess) toast.success(form.profileSuccess);
    if (form?.profileError) toast.error(form.profileError);
    if (form?.passwordSuccess) toast.success(form.passwordSuccess);
    if (form?.passwordError) toast.error(form.passwordError);
  });
</script>

<div class="container max-w-2xl space-y-6 py-6">
  <header>
    <a href="/" class="text-sm text-muted-foreground hover:underline">← Retour</a>
    <h1 class="mt-2 text-xl font-semibold">Mon compte</h1>
    {#if data.user}
      <p class="text-sm text-muted-foreground">{data.user.email}</p>
    {/if}
  </header>

  <Card class="p-4">
    <h2 class="text-base font-semibold">Profil</h2>
    <form method="POST" action="?/updateProfile" class="mt-3 grid gap-3">
      <div class="grid gap-1.5">
        <Label for="displayName">Nom affiché</Label>
        <Input id="displayName" name="displayName" required maxlength={80} value={data.user?.displayName ?? ''} />
      </div>
      <div>
        <Button type="submit">Enregistrer</Button>
      </div>
    </form>
  </Card>

  <Card class="p-4">
    <h2 class="text-base font-semibold">Mot de passe</h2>
    <form method="POST" action="?/changePassword" class="mt-3 grid gap-3">
      <div class="grid gap-1.5">
        <Label for="currentPassword">Mot de passe actuel</Label>
        <Input id="currentPassword" name="currentPassword" type="password" required autocomplete="current-password" />
      </div>
      <div class="grid gap-1.5">
        <Label for="newPassword">Nouveau mot de passe</Label>
        <Input id="newPassword" name="newPassword" type="password" required minlength={12} autocomplete="new-password" />
      </div>
      <div>
        <Button type="submit">Modifier</Button>
      </div>
    </form>
  </Card>

  <Card class="p-4">
    <h2 class="text-base font-semibold">Apparence</h2>
    <p class="mt-1 text-sm text-muted-foreground">Choisissez le thème de l'interface.</p>
    <div class="mt-3">
      <ThemeToggle />
    </div>
  </Card>

  <Card class="p-4">
    <h2 class="text-base font-semibold">Sessions</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      Déconnecte tous vos appareils. Vous devrez vous reconnecter ici.
    </p>
    <form method="POST" action="?/logoutEverywhere" class="mt-3">
      <Button type="submit" variant="outline">Se déconnecter partout</Button>
    </form>
  </Card>

  <Card class="p-4">
    <h2 class="text-base font-semibold">Déconnexion</h2>
    <form method="POST" action="/logout" class="mt-3">
      <Button type="submit" variant="outline">Se déconnecter</Button>
    </form>
  </Card>
</div>
