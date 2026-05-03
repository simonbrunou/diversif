<script lang="ts">
  type AllergenSummary = {
    introduced: number;
    total: number;
    ras: number;
    inconfort: number;
    reaction: number;
  };

  let { summary }: { summary: AllergenSummary } = $props();

  const total = $derived(summary.total);
  const remaining = $derived(Math.max(0, total - summary.introduced));
  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100);
</script>

<div
  class="space-y-2"
  role="img"
  aria-label="{summary.introduced} allergènes sur {total} introduits"
>
  <div class="flex items-baseline justify-between">
    <span class="text-sm font-medium">Allergènes</span>
    <span class="text-xs text-muted-foreground">{summary.introduced} / {total}</span>
  </div>
  <div class="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
    {#if summary.ras > 0}
      <div class="bg-reaction-ras" style="width: {pct(summary.ras)}%" title="RAS"></div>
    {/if}
    {#if summary.inconfort > 0}
      <div
        class="bg-reaction-inconfort"
        style="width: {pct(summary.inconfort)}%"
        title="Inconfort"
      ></div>
    {/if}
    {#if summary.reaction > 0}
      <div
        class="bg-reaction-reaction"
        style="width: {pct(summary.reaction)}%"
        title="Réaction"
      ></div>
    {/if}
  </div>
  <div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
    {#if summary.ras > 0}
      <span class="inline-flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full bg-reaction-ras"></span>
        RAS · {summary.ras}
      </span>
    {/if}
    {#if summary.inconfort > 0}
      <span class="inline-flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full bg-reaction-inconfort"></span>
        Inconfort · {summary.inconfort}
      </span>
    {/if}
    {#if summary.reaction > 0}
      <span class="inline-flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full bg-reaction-reaction"></span>
        Réaction · {summary.reaction}
      </span>
    {/if}
    {#if remaining > 0}
      <span class="inline-flex items-center gap-1.5">
        <span class="h-2 w-2 rounded-full bg-muted-foreground/30"></span>
        À tester · {remaining}
      </span>
    {/if}
  </div>
</div>
