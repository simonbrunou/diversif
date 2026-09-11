<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import { getAllergenLabel } from '$lib/utils/allergens';
  import * as m from '$lib/paraglide/messages';

  type SuggestedFood = {
    id: number;
    name: string;
    allergenType: string | null;
    suggestedAgeMonths: number;
  };

  let {
    foods,
    logHref
  }: {
    foods: SuggestedFood[];
    logHref: (foodId: number) => string;
  } = $props();
</script>

<section>
  <h2
    class="mb-2 text-sm font-semibold uppercase tracking-wider text-reaction-inconfort-foreground"
  >
    {m.suggestionsAllergensHeading()}
  </h2>
  <div class="grid gap-2 sm:grid-cols-2">
    {#each foods as f (f.id)}
      <a
        href={logHref(f.id)}
        aria-label={m.suggestionsLogAllergenAria({
          food: f.name,
          allergen:
            getAllergenLabel(f.allergenType) ?? f.allergenType ?? m.suggestionsAllergenUnknown(),
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
