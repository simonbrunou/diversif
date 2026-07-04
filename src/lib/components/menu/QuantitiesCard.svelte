<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import type { StageQuantities } from '$lib/content/quantities';
  import * as m from '$lib/paraglide/messages';

  let { quantities }: { quantities: StageQuantities } = $props();
</script>

<Card class="p-4">
  <h2 class="mb-3 text-sm font-semibold uppercase tracking-wider text-ink-soft">
    {m.quantitiesHeading()}
  </h2>
  <dl class="grid grid-cols-2 gap-3 tabular-nums sm:grid-cols-4">
    <div>
      <dt class="text-xs text-ink-soft">{m.quantitiesMilk()}</dt>
      <dd class="font-bold">{quantities.milkPerDay}</dd>
    </div>
    <div>
      <dt class="text-xs text-ink-soft">{m.quantitiesMeals()}</dt>
      <dd class="font-bold">{quantities.meals}</dd>
    </div>
    <div>
      <dt class="text-xs text-ink-soft">{m.quantitiesProtein()}</dt>
      <dd class="font-bold">{quantities.proteinPerDay}</dd>
    </div>
    {#if quantities.eggFraction}
      <div>
        <dt class="text-xs text-ink-soft">{m.quantitiesEgg()}</dt>
        <dd class="font-bold">{quantities.eggFraction}</dd>
      </div>
    {/if}
  </dl>
  <p class="mt-3 text-xs text-ink-soft">{m.quantitiesSatiety()}</p>
</Card>
