<script lang="ts">
  import { CheckCircle2, AlertCircle, OctagonAlert, CircleDashed } from 'lucide-svelte';

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

  // Each non-zero bar segment carries a non-color affordance via a CSS pattern,
  // so colorblind users can still tell RAS / inconfort / réaction apart on the
  // stacked bar itself. The legend below pairs the colors with lucide icons
  // (matching the ReactionPicker icons for consistency).
  const PATTERNS = {
    ras: 'repeating-linear-gradient(135deg, transparent 0 6px, rgba(255,255,255,0.45) 6px 8px)',
    inconfort: 'repeating-linear-gradient(45deg, transparent 0 5px, rgba(255,255,255,0.55) 5px 7px)',
    reaction:
      'repeating-linear-gradient(90deg, transparent 0 4px, rgba(255,255,255,0.65) 4px 5px)'
  } as const;

  function summaryLabel(s: AllergenSummary): string {
    const parts: string[] = [`${s.introduced} sur ${s.total} introduits`];
    if (s.ras > 0) parts.push(`${s.ras} bien tolérés`);
    if (s.inconfort > 0) parts.push(`${s.inconfort} avec petit inconfort`);
    if (s.reaction > 0) parts.push(`${s.reaction} avec réaction marquée`);
    if (s.total - s.introduced > 0) parts.push(`${s.total - s.introduced} restants à tester`);
    return parts.join(', ');
  }
</script>

<div class="space-y-2" role="img" aria-label={summaryLabel(summary)}>
  <div class="flex items-baseline justify-between">
    <span class="text-sm font-medium">Allergènes</span>
    <span class="text-xs text-muted-foreground">{summary.introduced} / {total}</span>
  </div>
  <div class="flex h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
    {#if summary.ras > 0}
      <div
        class="bg-reaction-ras"
        style="width: {pct(summary.ras)}%; background-image: {PATTERNS.ras};"
      ></div>
    {/if}
    {#if summary.inconfort > 0}
      <div
        class="bg-reaction-inconfort"
        style="width: {pct(summary.inconfort)}%; background-image: {PATTERNS.inconfort};"
      ></div>
    {/if}
    {#if summary.reaction > 0}
      <div
        class="bg-reaction-reaction"
        style="width: {pct(summary.reaction)}%; background-image: {PATTERNS.reaction};"
      ></div>
    {/if}
  </div>
  <ul class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
    {#if summary.ras > 0}
      <li class="inline-flex items-center gap-1.5">
        <CheckCircle2 size={12} class="text-reaction-ras" aria-hidden="true" />
        Bien toléré · {summary.ras}
      </li>
    {/if}
    {#if summary.inconfort > 0}
      <li class="inline-flex items-center gap-1.5">
        <AlertCircle size={12} class="text-reaction-inconfort" aria-hidden="true" />
        Petit inconfort · {summary.inconfort}
      </li>
    {/if}
    {#if summary.reaction > 0}
      <li class="inline-flex items-center gap-1.5">
        <OctagonAlert size={12} class="text-reaction-reaction" aria-hidden="true" />
        Réaction marquée · {summary.reaction}
      </li>
    {/if}
    {#if remaining > 0}
      <li class="inline-flex items-center gap-1.5">
        <CircleDashed size={12} class="text-muted-foreground/70" aria-hidden="true" />
        À tester · {remaining}
      </li>
    {/if}
  </ul>
</div>
