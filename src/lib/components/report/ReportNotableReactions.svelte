<script lang="ts">
  import { getCategoryLabel, type CategoryId } from '$lib/utils/categories';
  import { getReactionLabel } from '$lib/utils/reactions';
  import { reportReactionIcon, reportReactionClass, formatReportDay } from '$lib/utils/report';
  import type { ReactionId } from '$lib/utils/reaction-values';
  import * as m from '$lib/paraglide/messages';

  type ReportEntry = {
    id: number;
    foodName: string;
    category: CategoryId;
    reaction: ReactionId;
    givenAt: number;
    notes: string | null;
    mealId: string | null;
  };

  let {
    notable
  }: {
    notable: ReportEntry[];
  } = $props();
</script>

<section class="space-y-3">
  <h2 class="font-display text-xl font-semibold">{m.reportNotableHeading()}</h2>
  <ul class="space-y-2 text-sm">
    {#each notable as e (e.id)}
      {@const Icon = reportReactionIcon(e.reaction)}
      <li
        class="flex flex-col gap-1 border-b pb-1.5 print:break-inside-avoid print:border-black/15 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
      >
        <span class="flex min-w-0 items-baseline gap-1.5">
          <Icon size={12} class={reportReactionClass(e.reaction)} aria-hidden="true" />
          <span class="min-w-0">
            <strong>{e.foodName}</strong>
            <span class="text-xs text-muted-foreground">· {getCategoryLabel(e.category)}</span>
            {#if e.mealId}
              <span class="text-xs text-muted-foreground">· {m.reportNotableInMeal()}</span>
            {/if}
            {#if e.notes}
              <span class="mt-0.5 block whitespace-pre-wrap text-xs text-muted-foreground">
                {e.notes}
              </span>
            {/if}
          </span>
        </span>
        <span class="shrink-0 whitespace-nowrap text-xs text-muted-foreground sm:self-baseline">
          {formatReportDay(e.givenAt)} · {getReactionLabel(e.reaction)}
        </span>
      </li>
    {/each}
  </ul>
</section>
