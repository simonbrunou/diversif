<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import { CATEGORIES, getCategoryLabel } from '$lib/utils/categories';
  import { getAllergenLabel } from '$lib/utils/allergens';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function logHref(foodId: number): string {
    return `/child/${data.child.id}/log?foodId=${foodId}`;
  }

  function groupByCategory(items: typeof data.others) {
    const groups = new Map<string, typeof data.others>();
    for (const f of items) {
      if (!groups.has(f.category)) groups.set(f.category, []);
      groups.get(f.category)!.push(f);
    }
    return CATEGORIES.map((c) => ({ id: c.id, label: c.label, items: groups.get(c.id) ?? [] })).filter(
      (g) => g.items.length > 0
    );
  }

  const otherGroups = $derived(groupByCategory(data.others));
</script>

<div class="container max-w-2xl space-y-6 py-6">
  <header>
    <a href={`/child/${data.child.id}`} class="text-sm text-muted-foreground hover:underline">
      ← Tableau
    </a>
    <h1 class="mt-2 text-xl font-semibold">Suggestions</h1>
    <p class="text-sm text-muted-foreground">À introduire bientôt selon l’âge ({data.ageMonths} mois).</p>
  </header>

  {#if data.priorityAllergens.length === 0 && data.others.length === 0}
    <EmptyState
      title="Tout le catalogue a été introduit"
      description="Pensez à varier les préparations et à confirmer les introductions."
    />
  {:else}
    {#if data.priorityAllergens.length > 0}
      <section>
        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-reaction-inconfort">
          Allergènes à introduire
        </h2>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each data.priorityAllergens as f (f.id)}
            <a href={logHref(f.id)}>
              <Card class="p-3 transition-colors hover:bg-accent">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-medium">{f.name}</span>
                  <span class="shrink-0 rounded-full bg-reaction-inconfort/15 px-2 py-0.5 text-[11px] font-medium text-reaction-inconfort">
                    {getAllergenLabel(f.allergenType)}
                  </span>
                </div>
                <div class="text-xs text-muted-foreground">{getCategoryLabel(f.category)} · dès {f.suggestedAgeMonths} mois</div>
              </Card>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    {#each otherGroups as g (g.id)}
      <section>
        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {g.label}
        </h2>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each g.items as f (f.id)}
            <a href={logHref(f.id)}>
              <Card class="p-3 transition-colors hover:bg-accent">
                <div class="font-medium">{f.name}</div>
                <div class="text-xs text-muted-foreground">
                  dès {f.suggestedAgeMonths} mois
                  {#if f.allergenType}
                    · {getAllergenLabel(f.allergenType)}
                  {/if}
                </div>
              </Card>
            </a>
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>
