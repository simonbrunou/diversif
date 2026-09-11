<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import { getCategoryClasses, getCategoryIcon } from '$lib/utils/categories';
  import { getAllergenLabel } from '$lib/utils/allergens';
  import { cn } from '$lib/utils/cn';
  import * as m from '$lib/paraglide/messages';

  type SuggestedFood = {
    id: number;
    name: string;
    allergenType: string | null;
    suggestedAgeMonths: number;
  };

  let {
    categoryId,
    label,
    foods,
    logHref
  }: {
    categoryId: string;
    label: string;
    foods: SuggestedFood[];
    logHref: (foodId: number) => string;
  } = $props();

  const cls = $derived(getCategoryClasses(categoryId));
  const Icon = $derived(getCategoryIcon(categoryId));
</script>

<section>
  <h2
    class={cn(
      'mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider',
      cls.tint,
      cls.text
    )}
  >
    <Icon size={12} aria-hidden="true" />
    {label}
  </h2>
  <div class="grid gap-2 sm:grid-cols-2">
    {#each foods as f (f.id)}
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
