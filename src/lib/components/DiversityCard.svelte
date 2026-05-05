<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import { Layers, Clock, RotateCcw, Sparkles, Lightbulb } from 'lucide-svelte';
  import { cn } from '$lib/utils/cn';
  import type { DiversityMetrics } from '$lib/server/guidance/queries';

  let { metrics }: { metrics: DiversityMetrics } = $props();

  const lastNewLabel = $derived.by(() => {
    if (!metrics.lastNewFoodAt) return '—';
    const days = Math.floor((Date.now() - metrics.lastNewFoodAt) / (24 * 60 * 60 * 1000));
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return 'hier';
    return `il y a ${days} j`;
  });

  type ContextualMessage = {
    tone: 'celebrate' | 'info' | 'muted';
    text: string;
  };

  const contextual = $derived.by<ContextualMessage>(() => {
    const { categoriesCovered, totalCategories, lastNewFoodAt } = metrics;
    if (totalCategories > 0 && categoriesCovered >= totalCategories) {
      return {
        tone: 'celebrate',
        text: 'Toutes les familles couvertes — diversité au top.'
      };
    }
    const seventyPct = Math.ceil(totalCategories * 0.7);
    if (categoriesCovered >= seventyPct && categoriesCovered < totalCategories) {
      const remaining = totalCategories - categoriesCovered;
      return {
        tone: 'info',
        text: `Plus que ${remaining} groupe${remaining > 1 ? 's' : ''} pour faire le tour.`
      };
    }
    if (categoriesCovered >= 3) {
      return {
        tone: 'info',
        text: `${categoriesCovered} groupes couverts — joli début.`
      };
    }
    if (lastNewFoodAt == null) {
      return { tone: 'muted', text: 'Aucun aliment encore — à votre rythme.' };
    }
    const daysSinceNew = Math.floor((Date.now() - lastNewFoodAt) / (24 * 60 * 60 * 1000));
    if (daysSinceNew > 14) {
      return { tone: 'info', text: 'Une nouveauté cette semaine ?' };
    }
    return {
      tone: 'muted',
      text: 'L’acceptation gustative se construit avec la répétition — un aliment refusé peut être reproposé jusqu’à 10 fois.'
    };
  });
</script>

<Card class="p-4 md:p-5">
  <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
    <Layers size={14} aria-hidden="true" />
    Diversité
  </div>

  <dl class="mt-3 grid grid-cols-3 gap-3">
    <div>
      <dt class="text-[11px] uppercase tracking-wider text-muted-foreground">Catégories</dt>
      <dd class="mt-1 font-display text-2xl font-semibold leading-none tabular-nums">
        {metrics.categoriesCovered}
        <span class="font-sans text-base font-normal text-muted-foreground"
          >/ {metrics.totalCategories}</span
        >
      </dd>
      <p class="mt-1 text-[11px] text-muted-foreground">groupes couverts</p>
    </div>

    <div>
      <dt
        class="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground"
      >
        <Clock size={11} aria-hidden="true" />
        Nouveauté
      </dt>
      <dd class="mt-1 truncate font-display text-2xl font-semibold leading-none">{lastNewLabel}</dd>
      <p class="mt-1 text-[11px] text-muted-foreground">dernier nouvel aliment</p>
    </div>

    <div>
      <dt
        class="flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground"
      >
        <RotateCcw size={11} aria-hidden="true" />
        À reproposer
      </dt>
      <dd class="mt-1 font-display text-2xl font-semibold leading-none tabular-nums">
        {metrics.repeatExposureCount}
      </dd>
      <p class="mt-1 text-[11px] text-muted-foreground">testés &lt; 3 fois</p>
    </div>
  </dl>

  <p
    class={cn(
      'mt-3 flex items-start gap-2 border-l-2 py-0.5 pl-2.5 text-[11px] leading-relaxed',
      contextual.tone === 'celebrate' && 'border-celebrate text-celebrate-foreground',
      contextual.tone === 'info' && 'border-primary/50 text-foreground/80',
      contextual.tone === 'muted' && 'border-transparent text-muted-foreground'
    )}
  >
    {#if contextual.tone === 'celebrate'}
      <Sparkles size={12} class="mt-0.5 shrink-0 text-celebrate" aria-hidden="true" />
    {:else if contextual.tone === 'info'}
      <Lightbulb size={12} class="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
    {/if}
    <span>{contextual.text}</span>
  </p>
</Card>
