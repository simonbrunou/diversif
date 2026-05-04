<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Card from '$components/ui/Card.svelte';
  import ThemeToggle from '$components/ThemeToggle.svelte';
  import { invalidateAll } from '$app/navigation';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let passkeyName = $state('');
  let registering = $state(false);
  let supported = $state(false);

  $effect(() => {
    if (!browser) return;
    supported =
      typeof window !== 'undefined' &&
      typeof window.PublicKeyCredential === 'function' &&
      typeof navigator.credentials?.create === 'function';
  });

  $effect(() => {
    if (form?.profileSuccess) toast.success(form.profileSuccess);
    if (form?.profileError) toast.error(form.profileError);
    if (form?.passwordSuccess) toast.success(form.passwordSuccess);
    if (form?.passwordError) toast.error(form.passwordError);
    if (form?.passkeySuccess) toast.success(form.passkeySuccess);
    if (form?.passkeyError) toast.error(form.passkeyError);
  });

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleDateString('fr-FR', {
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
      if (!optsRes.ok) throw new Error('Impossible de démarrer l’enregistrement.');
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
      toast.success('Clé enregistrée.');
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
    <h2 class="text-base font-semibold">Clés d'accès (passkeys)</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      Connectez-vous sans mot de passe avec votre empreinte, FaceID ou une clé physique.
    </p>

    {#if data.passkeys.length === 0}
      <p class="mt-3 text-sm text-muted-foreground">Aucune clé enregistrée.</p>
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
                aria-label="Nom de la clé"
              />
              <Button type="submit" size="sm" variant="outline">Renommer</Button>
            </form>
            <div class="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Ajoutée le {formatDate(p.createdAt)}{#if p.lastUsedAt} · dernière utilisation le {formatDate(p.lastUsedAt)}{/if}
                {#if p.backedUp} · synchronisée{/if}
              </span>
              <form method="POST" action="?/deletePasskey">
                <input type="hidden" name="id" value={p.id} />
                <Button type="submit" size="sm" variant="destructive">Supprimer</Button>
              </form>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    {#if supported}
      <div class="mt-4 grid gap-3 border-t border-border pt-4">
        <div class="grid gap-1.5">
          <Label for="passkeyName">Nom de la nouvelle clé</Label>
          <Input
            id="passkeyName"
            placeholder="iPhone, MacBook…"
            maxlength={80}
            bind:value={passkeyName}
          />
        </div>
        <div>
          <Button type="button" onclick={registerPasskey} loading={registering}>
            {registering ? 'Enregistrement…' : 'Ajouter une clé'}
          </Button>
        </div>
      </div>
    {:else}
      <p class="mt-4 text-sm text-muted-foreground">
        Votre navigateur ne prend pas en charge les clés d'accès.
      </p>
    {/if}
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
