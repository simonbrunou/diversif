<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import ChildHeader from '$lib/components/ChildHeader.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ReactionBadge from '$lib/components/ReactionBadge.svelte';
  import { formatRelative } from '$lib/utils/dates';
  import { getCategoryLabel } from '$lib/utils/categories';
  import { page } from '$app/stores';
  import { toast } from 'svelte-sonner';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  $effect(() => {
    if ($page.url.searchParams.get('logged') === '1') {
      toast.success('Aliment enregistré.');
      const url = new URL($page.url);
      url.searchParams.delete('logged');
      history.replaceState({}, '', url);
    }
  });
</script>

<div class="container max-w-2xl space-y-6 py-6">
  <ChildHeader name={data.child.name} birthDate={data.child.birthDate} />

  <Button href={`/child/${data.child.id}/log`} size="lg" class="w-full text-base">
    + Logguer un aliment
  </Button>

  <div class="grid grid-cols-2 gap-3">
    <Card class="p-4">
      <div class="text-3xl font-semibold leading-tight">{data.stats.foodsIntroduced}</div>
      <div class="text-xs text-muted-foreground">aliments introduits</div>
    </Card>
    <Card class="p-4">
      <div class="text-3xl font-semibold leading-tight">
        {data.stats.allergensIntroduced} <span class="text-base text-muted-foreground">/ {data.stats.allergensTotal}</span>
      </div>
      <div class="text-xs text-muted-foreground">allergènes testés</div>
    </Card>
  </div>

  <section>
    <div class="mb-2 flex items-center justify-between">
      <h2 class="text-base font-semibold">Derniers logs</h2>
      <a href={`/child/${data.child.id}/foods`} class="text-sm text-primary hover:underline">
        Tout voir
      </a>
    </div>

    {#if data.recent.length === 0}
      <EmptyState
        title="Pas encore de log"
        description="Commencez à enregistrer les aliments donnés à {data.child.name}."
      >
        {#snippet action()}
          <Button href={`/child/${data.child.id}/log`}>Logguer le premier</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <ul class="divide-y rounded-lg border bg-card">
        {#each data.recent as e (e.id)}
          <li class="flex items-center justify-between gap-3 p-4">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium">{e.foodName}</span>
                <ReactionBadge reaction={e.reaction} />
              </div>
              <div class="mt-0.5 text-xs text-muted-foreground">
                {formatRelative(e.givenAt)} · par {e.loggedByName}
                <span class="opacity-70">· {getCategoryLabel(e.category)}</span>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="grid grid-cols-2 gap-3">
    <a href={`/child/${data.child.id}/allergens`}>
      <Card class="p-4 transition-colors hover:bg-accent">
        <div class="text-sm font-medium">Allergènes</div>
        <div class="text-xs text-muted-foreground">Suivi des introductions</div>
      </Card>
    </a>
    <a href={`/child/${data.child.id}/suggestions`}>
      <Card class="p-4 transition-colors hover:bg-accent">
        <div class="text-sm font-medium">Suggestions</div>
        <div class="text-xs text-muted-foreground">À introduire bientôt</div>
      </Card>
    </a>
  </section>

  <div class="text-center">
    <a href={`/child/${data.child.id}/settings`} class="text-sm text-muted-foreground hover:underline">
      Paramètres de l’enfant
    </a>
  </div>
</div>
