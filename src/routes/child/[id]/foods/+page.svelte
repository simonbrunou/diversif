<script lang="ts">
  import Input from '$components/ui/Input.svelte';
  import Select from '$components/ui/Select.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import ReactionBadge from '$lib/components/ReactionBadge.svelte';
  import CategoryTag from '$lib/components/CategoryTag.svelte';
  import { CATEGORIES } from '$lib/utils/categories';
  import { getAllergenLabel } from '$lib/utils/allergens';
  import { formatRelative } from '$lib/utils/dates';
  import { Apple, RotateCcw } from 'lucide-svelte';
  import { cn } from '$lib/utils/cn';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { PageData } from './$types';
  import { page } from '$app/stores';
  import CarnetBento from '$lib/components/bento/CarnetBento.svelte';
  import type { Segment } from '$lib/components/bento/CarnetSegments.svelte';

  let { data }: { data: PageData } = $props();

  const repeatHref = $derived.by(() => {
    const params = new URLSearchParams();
    if (data.filters.q) params.set('q', data.filters.q);
    if (data.filters.category) params.set('category', data.filters.category);
    if (data.filters.reaction) params.set('reaction', data.filters.reaction);
    if (!data.filters.repeat) params.set('repeat', '1');
    const qs = params.toString();
    return qs ? `?${qs}` : '?';
  });

  const VALID_SEGMENTS: Segment[] = ['all', 'categories', 'allergens', 'stats'];

  const currentSegment = $derived<Segment>(
    (() => {
      const q = $page.url.searchParams.get('segment');
      return (VALID_SEGMENTS as string[]).includes(q ?? '') ? (q as Segment) : 'all';
    })()
  );

  // Phase 4 placeholders. Phase 5 wires real allergen + stats data.
  const bentoAllergens: Array<{
    id: string;
    label: string;
    triedCount: number;
    lastTried: string | null;
    state: 'cleared' | 'todo' | 'reaction';
  }> = [];
  const bentoStats = $derived({
    diversityScore: data.categoryCount,
    distinctFoods: data.foodCount,
    weeklyEntries: [] as number[]
  });
</script>

{#if data.bento}
  <CarnetBento
    childId={String(data.child?.id ?? '')}
    foods={data.bentoFoods ?? []}
    foodCount={data.foodCount ?? 0}
    categoryCount={data.categoryCount ?? 0}
    allergens={bentoAllergens}
    stats={bentoStats}
    {currentSegment}
  />
{:else}
  <div class="container max-w-2xl space-y-5 py-6">
    <header>
      <a href={localizedHref(`/child/${data.child.id}`)} class="text-sm text-muted-foreground hover:underline">
        ← Tableau
      </a>
      <h1 class="mt-2 text-xl font-semibold">Le carnet de {data.child.name}</h1>
    </header>

    <form method="GET" class="grid gap-2 sm:grid-cols-[1fr,auto,auto,auto]">
      <Input type="search" name="q" placeholder="Rechercher…" value={data.filters.q} />
      <Select name="category" value={data.filters.category}>
        <option value="">Toutes catégories</option>
        {#each CATEGORIES as c (c.id)}
          <option value={c.id}>{c.label}</option>
        {/each}
      </Select>
      <Select name="reaction" value={data.filters.reaction}>
        <option value="">Toutes réactions</option>
        <option value="ras">Tout va bien</option>
        <option value="inconfort">Petit inconfort</option>
        <option value="reaction">Réaction marquée</option>
      </Select>
      {#if data.filters.repeat}
        <input type="hidden" name="repeat" value="1" />
      {/if}
      <Button type="submit" variant="secondary">Filtrer</Button>
    </form>

    <div class="flex flex-wrap items-center gap-2">
      <a
        href={repeatHref}
        title="Aliments donnés moins de 3 fois et bien tolérés — à reproposer pour consolider l'acceptation gustative"
        class={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          data.filters.repeat
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
      >
        <RotateCcw size={12} aria-hidden="true" />
        À reproposer
      </a>
      {#if data.filters.repeat}
        <span class="text-xs text-muted-foreground">
          L'acceptation gustative se construit avec la répétition (jusqu'à 10 fois).
        </span>
      {/if}
    </div>

    {#if data.entries.length === 0}
      <EmptyState
        icon={Apple}
        title="Rien dans ce filtre"
        description="Élargissez la recherche ou notez un nouveau repas."
      >
        {#snippet action()}
          <Button href={localizedHref(`/child/${data.child.id}/log`)}>Noter un repas</Button>
        {/snippet}
      </EmptyState>
    {:else}
      <Card>
        <ul class="divide-y">
          {#each data.entries as e (e.id)}
            <li>
              <a
                href={localizedHref(`/child/${data.child.id}/log/${e.id}?from=foods`)}
                class="flex items-start justify-between gap-3 p-4 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate font-medium">{e.foodName}</span>
                    {#if e.isCustom}
                      <Badge variant="outline" class="text-[10px] uppercase tracking-wider">
                        Hors catalogue
                      </Badge>
                    {/if}
                  </div>
                  <div class="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{formatRelative(e.givenAt)} · par {e.loggedByName}</span>
                    <CategoryTag id={e.category} size="sm" />
                    {#if e.allergenType}
                      <span class="text-reaction-inconfort">· {getAllergenLabel(e.allergenType)}</span>
                    {/if}
                  </div>
                  {#if e.notes}
                    <p class="mt-1 line-clamp-2 text-sm text-muted-foreground">{e.notes}</p>
                  {/if}
                </div>
                <ReactionBadge reaction={e.reaction} />
              </a>
            </li>
          {/each}
        </ul>
      </Card>
    {/if}
  </div>
{/if}
