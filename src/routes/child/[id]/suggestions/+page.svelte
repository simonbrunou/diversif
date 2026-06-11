<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import CalloutCard from '$components/ui/CalloutCard.svelte';
  import TipCard from '$lib/components/TipCard.svelte';
  import {
    CATEGORIES,
    getCategoryClasses,
    getCategoryIcon,
    getCategoryLabel
  } from '$lib/utils/categories';
  import { getAllergenLabel } from '$lib/utils/allergens';
  import { cn } from '$lib/utils/cn';
  import { Sparkles, Lightbulb } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
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

<div class="mx-auto w-full px-4 max-w-2xl space-y-6 py-6">
  <BackHeader
    title={m.suggestionsTitle()}
    subtitle={data.ageMonths === 1
      ? m.suggestionsSubtitleOne({ name: data.child.name })
      : m.suggestionsSubtitleOther({ name: data.child.name, ageMonths: data.ageMonths })}
    fallback={`/child/${data.child.id}`}
  />

  <TipCard
    tone="info"
    icon={Lightbulb}
    eyebrow={m.suggestionsTipEyebrow()}
    body={m.suggestionsTipBody()}
    sources={['spf-pnns-guide']}
  />

  {#if data.priorityAllergens.length === 0 && data.others.length === 0}
    <CalloutCard icon={Sparkles} title={m.suggestionsEmptyTitle()}>
      {m.suggestionsEmptyBody()}
    </CalloutCard>
  {:else}
    {#if data.priorityAllergens.length > 0}
      <section>
        <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-reaction-inconfort-foreground">
          {m.suggestionsAllergensHeading()}
        </h2>
        <div class="grid gap-2 sm:grid-cols-2">
          {#each data.priorityAllergens as f (f.id)}
            <a
              href={logHref(f.id)}
              aria-label={m.suggestionsLogAllergenAria({
                food: f.name,
                allergen:
                  getAllergenLabel(f.allergenType) ??
                  f.allergenType ??
                  m.suggestionsAllergenUnknown(),
                months: f.suggestedAgeMonths
              })}
            >
              <Card class="p-3 transition-colors hover:bg-accent">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate font-medium">{f.name}</span>
                  <Badge variant="inconfort" class="shrink-0">
                    {getAllergenLabel(f.allergenType)}
                  </Badge>
                </div>
                <div class="text-xs text-muted-foreground">
                  {m.suggestionsFromMonths({ months: f.suggestedAgeMonths })}
                </div>
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
              aria-label={f.allergenType
                ? m.suggestionsLogFoodAllergenAria({
                    food: f.name,
                    months: f.suggestedAgeMonths,
                    allergen: getAllergenLabel(f.allergenType) ?? f.allergenType
                  })
                : m.suggestionsLogFoodAria({ food: f.name, months: f.suggestedAgeMonths })}
            >
              <Card class="p-3 transition-colors hover:bg-accent">
                <div class="font-medium">{f.name}</div>
                <div class="text-xs text-muted-foreground">
                  {m.suggestionsFromMonths({ months: f.suggestedAgeMonths })}
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
