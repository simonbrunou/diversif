<script lang="ts">
  import type { Stage } from '$lib/content/guidance';
  import { Baby } from 'lucide-svelte';
  import { cn } from '$lib/utils/cn';

  let { stage, class: className = '' }: { stage: Stage; class?: string } = $props();
</script>

<span
  class={cn(
    'inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary',
    className
  )}
>
  <Baby size={14} aria-hidden="true" />
  Étape {stage.id} mois
</span>
