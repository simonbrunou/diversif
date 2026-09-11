<script lang="ts">
  import CategoryTag from '$lib/components/CategoryTag.svelte';
  import { reportReactionIcon, reportReactionClass, formatReportDay } from '$lib/utils/report';
  import type { ReactionId } from '$lib/utils/reaction-values';
  import type { CategoryId } from '$lib/utils/categories';
  import * as m from '$lib/paraglide/messages';

  type ReportFood = {
    foodId: number;
    foodName: string;
    firstGivenAt: number;
    exposures: number;
    worstReaction: ReactionId;
  };

  let {
    categoryGroups
  }: {
    categoryGroups: { id: CategoryId; foods: ReportFood[] }[];
  } = $props();
</script>

<section class="space-y-3">
  <h2 class="font-display text-xl font-semibold">{m.reportFoodsByCategoryHeading()}</h2>
  {#if categoryGroups.length === 0}
    <p class="text-sm text-muted-foreground">{m.reportFoodsByCategoryEmpty()}</p>
  {:else}
    <div class="space-y-3">
      {#each categoryGroups as g (g.id)}
        <div class="break-inside-avoid space-y-1.5">
          <div class="flex items-center gap-2">
            <CategoryTag id={g.id} size="sm" />
            <span class="text-xs text-muted-foreground">{g.foods.length}</span>
          </div>
          <ul class="grid gap-1 pl-1 text-sm sm:grid-cols-2 print:grid-cols-2">
            {#each g.foods as f (f.foodId)}
              {@const FoodIcon = reportReactionIcon(f.worstReaction)}
              <li
                class="flex items-baseline justify-between gap-2 border-b pb-0.5 print:break-inside-avoid print:border-black/15"
              >
                <span class="flex min-w-0 items-baseline gap-1.5">
                  <FoodIcon
                    size={11}
                    class={reportReactionClass(f.worstReaction)}
                    aria-hidden="true"
                  />
                  <!-- Truncate on screen to keep the grid tidy, but allow wrapping
                       in print so a long custom food name (e.g. "Purée de
                       courgette maison aux oignons") isn't silently ellipsis'd
                       out of the pediatric report. -->
                  <span class="truncate print:overflow-visible print:whitespace-normal">
                    {f.foodName}
                  </span>
                </span>
                <span class="shrink-0 text-xs text-muted-foreground">
                  {m.reportExposuresSince({
                    count: String(f.exposures),
                    date: formatReportDay(f.firstGivenAt)
                  })}
                </span>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  {/if}
</section>
