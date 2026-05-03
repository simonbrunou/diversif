<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import { Layers, Clock, RotateCcw } from 'lucide-svelte';
  import dayjs from 'dayjs';
  import type { DiversityMetrics } from '$lib/server/guidance/queries';

  let { metrics }: { metrics: DiversityMetrics } = $props();

  const lastNewLabel = $derived.by(() => {
    if (!metrics.lastNewFoodAt) return '—';
    const days = Math.floor((Date.now() - metrics.lastNewFoodAt) / (24 * 60 * 60 * 1000));
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return 'hier';
    return `il y a ${days} j`;
  });

  const _ = dayjs; // silence unused lint if needed
</script>

<Card class="p-4 md:p-5">
  <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
    <Layers size={14} aria-hidden="true" />
    Diversité
  </div>

  <dl class="mt-3 grid grid-cols-3 gap-3">
    <div>
      <dt class="text-[11px] uppercase tracking-wider text-muted-foreground">Catégories</dt>
      <dd class="mt-1 text-2xl font-semibold leading-none">
        {metrics.categoriesCovered}
        <span class="text-base font-normal text-muted-foreground">/ {metrics.totalCategories}</span>
      </dd>
      <p class="mt-1 text-[11px] text-muted-foreground">groupes couverts</p>
    </div>

    <div>
      <dt class="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Clock size={11} aria-hidden="true" />
        Nouveauté
      </dt>
      <dd class="mt-1 truncate text-2xl font-semibold leading-none">{lastNewLabel}</dd>
      <p class="mt-1 text-[11px] text-muted-foreground">dernier nouvel aliment</p>
    </div>

    <div>
      <dt class="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        <RotateCcw size={11} aria-hidden="true" />
        À reproposer
      </dt>
      <dd class="mt-1 text-2xl font-semibold leading-none">{metrics.repeatExposureCount}</dd>
      <p class="mt-1 text-[11px] text-muted-foreground">testés &lt; 3 fois</p>
    </div>
  </dl>

  <p class="mt-3 text-[11px] leading-relaxed text-muted-foreground">
    L'acceptation gustative se construit avec la répétition — un aliment refusé peut être
    reproposé jusqu'à 10 fois.
  </p>
</Card>
