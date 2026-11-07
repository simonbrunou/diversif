<script lang="ts">
  import type { Stage, StageId } from '#lib/content/guidance.js';
  import { stageRange } from '#lib/content/stage-range.js';
  import { Baby } from '@lucide/svelte';
  import { cn } from '#lib/utils/cn.js';
  import * as m from '#lib/paraglide/messages.js';
  import { getLocale } from '#lib/paraglide/runtime.js';

  let { stage, class: className = '' }: { stage: Stage; class?: string } = $props();

  const STAGE_TONES: Record<StageId, string> = {
    '4-6': 'bg-accent-peach/40 dark:bg-accent-peach/15 text-tile-peach-foreground',
    '6-9': 'bg-accent-butter/50 dark:bg-accent-butter/15 text-tile-butter-foreground',
    '9-12': 'bg-accent-mint/50 dark:bg-accent-mint/15 text-tile-mint-foreground',
    '12-36': 'bg-accent-sky/45 dark:bg-accent-sky/15 text-tile-sky-foreground'
  };
  const tone = $derived(STAGE_TONES[stage.id]);
</script>

<!-- /guide wraps its sections in <section lang="fr">, also on /en/guide where
     this label prints in English: the label declares its own language. -->
<span
  lang={getLocale()}
  class={cn(
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium',
    tone,
    className
  )}
>
  <Baby size={14} aria-hidden="true" />
  {m.stageBadgeLabel({ range: stageRange(stage) })}
</span>
