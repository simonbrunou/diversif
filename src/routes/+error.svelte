<script lang="ts">
  import { page } from '$app/stores';
  import Button from '$components/ui/Button.svelte';
  import { AlertTriangle } from 'lucide-svelte';

  const status = $derived($page.status);
  const message = $derived($page.error?.message ?? 'Une erreur est survenue.');
  const title = $derived(status === 404 ? 'Page introuvable' : 'Oups, quelque chose a échoué');
</script>

<div class="container flex max-w-md flex-1 flex-col items-center justify-center gap-5 py-16 text-center">
  <div class="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
    <AlertTriangle size={28} aria-hidden="true" />
  </div>
  <div>
    <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Erreur {status}</p>
    <h1 class="mt-1 text-2xl font-semibold">{title}</h1>
    <p class="mt-2 text-sm text-muted-foreground">{message}</p>
  </div>
  <div class="flex flex-wrap justify-center gap-2">
    <Button href="/">Retour à l’accueil</Button>
    <Button variant="outline" onclick={() => history.back()}>Page précédente</Button>
  </div>
</div>
