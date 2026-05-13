<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import TipCard from '$lib/components/TipCard.svelte';
  import {
    CATEGORIES,
    getCategoryClasses,
    getCategoryIcon,
    getCategoryLabel
  } from '$lib/utils/categories';
  import { getAllergenLabel } from '$lib/utils/allergens';
  import { cn } from '$lib/utils/cn';
  import { localizedHref } from '$lib/utils/localized-href';
  import { Sparkles, Lightbulb } from 'lucide-svelte';
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
    return CATEGORIES.map((c) => ({ id: c.id, label: getCategoryLabel(c.id), items: groups.get(c.id) ?? [] })).filter(
      (g) => g.items.length > 0
    );
  }

  const otherGroups = $derived(groupByCategory(data.others));
</script>

<div class="container max-w-2xl space-y-6 py-6">
  <header>
    <a href={localizedHref(`/child/${data.child.id}`)} class="text-sm text-muted-foreground hover:underline">
      ← Tableau
    </a>
    <h1 class="mt-2 text-xl font-semibold">Suggestions</h1>
    <p class="text-sm text-muted-foreground">
      À tester ces jours-ci selon l’âge de {data.child.name} ({data.ageMonths} mois).
    </p>
  </header>

  <TipCard
    tone="info"
    icon={Lightbulb}
    eyebrow="Bon à savoir"
    body="Ces suggestions excluent les aliments déjà loggués et privilégient en haut les allergènes pas encore introduits. Reproposez un nouvel aliment jusqu'à 10 fois pour qu'il soit accepté : l'acceptation gustative se construit avec la répétition."
    sources={['spf-pnns-guide']}
  />

  {#if data.priorityAllergens.length === 0 && data.others.length === 0}
    <EmptyState
      icon={Sparkles}
      title="Vous avez fait le tour du catalogue"
      description="Variez les préparations et confirmez les introductions à votre rythme."
    />
  {:else}
    {#if data.priorityAllergens.length > 0}
      <section>
        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-reaction-inconfort">
          Allergènes à introduire
        </h2>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each data.priorityAllergens as f (f.id)}
            <a
              href={logHref(f.id)}
              aria-label={`Noter ${f.name}, allergène ${getAllergenLabel(f.allergenType) ?? f.allergenType ?? 'inconnu'}, dès ${f.suggestedAgeMonths} mois`}
            >
              <Card class="p-3 transition-colors hover:bg-accent">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-medium">{f.name}</span>
                  <Badge variant="inconfort" class="shrink-0">
                    {getAllergenLabel(f.allergenType)}
                  </Badge>
                </div>
                <div class="text-xs text-muted-foreground">dès {f.suggestedAgeMonths} mois</div>
              </Card>
            </a>
          {/each}
        </div>
      </section>
    {/if}

    {#each otherGroups as g (g.id)}
      {@const cls = getCategoryClasses(g.id)}
      {@const Icon = getCategoryIcon(g.id)}
      <section>
        <h2
          class={cn(
            'mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider',
            cls.tint,
            cls.text
          )}
        >
          <Icon size={12} aria-hidden="true" />
          {g.label}
        </h2>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each g.items as f (f.id)}
            <a
              href={logHref(f.id)}
              aria-label={`Noter ${f.name}, dès ${f.suggestedAgeMonths} mois${f.allergenType ? `, ${getAllergenLabel(f.allergenType) ?? f.allergenType}` : ''}`}
            >
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
