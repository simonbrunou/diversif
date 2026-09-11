<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  let {
    totals
  }: {
    totals: {
      foods: number;
      entries: number;
      categoriesCovered: number;
      categoriesTotal: number;
      allergensIntroduced: number;
      allergensTotal: number;
    };
  } = $props();
</script>

<section class="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
  <div class="rounded-md border p-3 print:border-black/20">
    <div class="text-2xs uppercase tracking-wider text-muted-foreground">
      {m.reportTotalsFoodsLabel()}
    </div>
    <div class="mt-1 font-display text-xl font-semibold leading-none tabular-nums">
      {totals.foods}
    </div>
    <div class="mt-1 text-2xs text-muted-foreground">{m.reportTotalsFoodsCaption()}</div>
  </div>
  <div class="rounded-md border p-3 print:border-black/20">
    <div class="text-2xs uppercase tracking-wider text-muted-foreground">
      {m.reportTotalsEntriesLabel()}
    </div>
    <div class="mt-1 font-display text-xl font-semibold leading-none tabular-nums">
      {totals.entries}
    </div>
    <div class="mt-1 text-2xs text-muted-foreground">{m.reportTotalsEntriesCaption()}</div>
  </div>
  <div class="rounded-md border p-3 print:border-black/20">
    <div class="text-2xs uppercase tracking-wider text-muted-foreground">
      {m.reportTotalsCategoriesLabel()}
    </div>
    <div class="mt-1 font-display text-xl font-semibold leading-none tabular-nums">
      {totals.categoriesCovered}<span class="text-sm font-normal text-muted-foreground">
        / {totals.categoriesTotal}</span
      >
    </div>
    <div class="mt-1 text-2xs text-muted-foreground">{m.reportTotalsCategoriesCaption()}</div>
  </div>
  <div class="rounded-md border p-3 print:border-black/20">
    <div class="text-2xs uppercase tracking-wider text-muted-foreground">
      {m.reportTotalsAllergensLabel()}
    </div>
    <div class="mt-1 font-display text-xl font-semibold leading-none tabular-nums">
      {totals.allergensIntroduced}<span class="text-sm font-normal text-muted-foreground">
        / {totals.allergensTotal}</span
      >
    </div>
    <div class="mt-1 text-2xs text-muted-foreground">{m.reportTotalsAllergensCaption()}</div>
  </div>
</section>
