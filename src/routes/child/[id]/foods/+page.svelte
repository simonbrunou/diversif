<script lang="ts">
  import Input from '$components/ui/Input.svelte';
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ReactionBadge from '$lib/components/ReactionBadge.svelte';
  import { CATEGORIES, getCategoryLabel } from '$lib/utils/categories';
  import { getAllergenLabel } from '$lib/utils/allergens';
  import { formatRelative } from '$lib/utils/dates';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="container max-w-2xl space-y-5 py-6">
  <header>
    <a href={`/child/${data.child.id}`} class="text-sm text-muted-foreground hover:underline">
      ← Tableau
    </a>
    <h1 class="mt-2 text-xl font-semibold">Aliments donnés à {data.child.name}</h1>
  </header>

  <form method="GET" class="grid gap-2 sm:grid-cols-[1fr,auto,auto,auto]">
    <Input type="search" name="q" placeholder="Rechercher…" value={data.filters.q} />
    <select
      name="category"
      class="h-10 rounded-md border bg-background px-3 text-sm"
      value={data.filters.category}
    >
      <option value="">Toutes catégories</option>
      {#each CATEGORIES as c (c.id)}
        <option value={c.id}>{c.label}</option>
      {/each}
    </select>
    <select
      name="reaction"
      class="h-10 rounded-md border bg-background px-3 text-sm"
      value={data.filters.reaction}
    >
      <option value="">Toutes réactions</option>
      <option value="ras">RAS</option>
      <option value="inconfort">Inconfort</option>
      <option value="reaction">Réaction</option>
    </select>
    <Button type="submit" variant="secondary">Filtrer</Button>
  </form>

  {#if data.entries.length === 0}
    <EmptyState
      title="Aucun aliment"
      description="Affinez vos filtres ou commencez à logguer."
    >
      {#snippet action()}
        <Button href={`/child/${data.child.id}/log`}>+ Logguer</Button>
      {/snippet}
    </EmptyState>
  {:else}
    <Card>
      <ul class="divide-y">
        {#each data.entries as e (e.id)}
          <li class="flex items-start justify-between gap-3 p-4">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="truncate font-medium">{e.foodName}</span>
                {#if e.isCustom}
                  <span class="text-[10px] uppercase tracking-wider text-muted-foreground">Hors catalogue</span>
                {/if}
              </div>
              <div class="mt-0.5 text-xs text-muted-foreground">
                {formatRelative(e.givenAt)} · par {e.loggedByName}
                · {getCategoryLabel(e.category)}
                {#if e.allergenType}
                  · <span class="text-reaction-inconfort">{getAllergenLabel(e.allergenType)}</span>
                {/if}
              </div>
              {#if e.notes}
                <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.notes}</p>
              {/if}
            </div>
            <ReactionBadge reaction={e.reaction} />
          </li>
        {/each}
      </ul>
    </Card>
  {/if}
</div>
