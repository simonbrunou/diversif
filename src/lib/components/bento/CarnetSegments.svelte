<script lang="ts" module>
  export type Segment = 'all' | 'categories' | 'allergens' | 'stats';

  type Entry = {
    id: Segment;
    labelKey: 'carnetSegmentsTous' | 'carnetSegmentsCategories' | 'carnetSegmentsAllergenes' | 'carnetSegmentsStats';
    query: string;
  };

  export const SEGMENTS: Entry[] = [
    { id: 'all', labelKey: 'carnetSegmentsTous', query: '' },
    { id: 'categories', labelKey: 'carnetSegmentsCategories', query: '?segment=categories' },
    { id: 'allergens', labelKey: 'carnetSegmentsAllergenes', query: '?segment=allergens' },
    { id: 'stats', labelKey: 'carnetSegmentsStats', query: '?segment=stats' }
  ];
</script>

<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  let {
    childId,
    currentSegment
  }: { childId: string; currentSegment: Segment } = $props();
</script>

<nav
  aria-label="Sections du carnet"
  class="mb-3 flex gap-1 rounded-full border border-border/40 bg-canvas p-1"
>
  {#each SEGMENTS as seg (seg.id)}
    {@const active = seg.id === currentSegment}
    <a
      href={`/child/${childId}/foods${seg.query}`}
      aria-current={active ? 'page' : undefined}
      data-sveltekit-noscroll
      data-sveltekit-keepfocus
      data-sveltekit-replacestate
      class={cn(
        'flex-1 rounded-full px-3 py-1.5 text-center text-xs font-semibold transition-colors duration-base ease-soft active:scale-[0.97]',
        active ? 'bg-primary text-primary-foreground' : 'text-ink-soft hover:text-foreground'
      )}
    >
      {m[seg.labelKey]()}
    </a>
  {/each}
</nav>
