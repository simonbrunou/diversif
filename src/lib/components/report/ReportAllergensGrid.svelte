<script lang="ts">
  import { reportReactionIcon, reportReactionClass, formatReportDay } from '$lib/utils/report';
  import type { ReactionId } from '$lib/utils/reaction-values';
  import { CircleDashed } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';

  type AllergenRow = {
    id: string;
    label: string;
    status: 'introduced' | 'untested';
    worst: ReactionId | null;
    exposures: number;
    firstGivenAt: number | null;
  };

  let {
    allergens
  }: {
    allergens: AllergenRow[];
  } = $props();
</script>

<section class="space-y-3 break-inside-avoid">
  <h2 class="font-display text-xl font-semibold">{m.reportAllergensHeading()}</h2>
  <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2 print:grid-cols-2">
    {#each allergens as a (a.id)}
      {@const Icon = a.status === 'untested' ? CircleDashed : reportReactionIcon(a.worst!)}
      <li
        class="flex items-center justify-between gap-3 rounded-md border p-2.5 text-sm print:border-black/20"
      >
        <div class="flex min-w-0 items-center gap-2">
          <Icon
            size={14}
            class={a.status === 'untested'
              ? 'text-muted-foreground/60'
              : reportReactionClass(a.worst!)}
            aria-hidden="true"
          />
          <span class="truncate font-medium">{a.label}</span>
        </div>
        {#if a.status === 'introduced'}
          <span class="shrink-0 text-xs text-muted-foreground">
            {m.reportExposuresSince({
              count: String(a.exposures),
              date: formatReportDay(a.firstGivenAt!)
            })}
          </span>
        {:else}
          <span class="shrink-0 text-xs text-muted-foreground">{m.reportAllergenUntested()}</span>
        {/if}
      </li>
    {/each}
  </ul>
</section>
