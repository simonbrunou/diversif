<script lang="ts" module>
  export type Segment = 'all' | 'categories' | 'allergens' | 'stats';

  type Entry = {
    id: Segment;
    labelKey: 'carnetSegmentsTous' | 'carnetSegmentsCategories' | 'carnetSegmentsAllergenes' | 'carnetSegmentsBilan';
    query: string;
  };

  export const SEGMENTS: Entry[] = [
    { id: 'all', labelKey: 'carnetSegmentsTous', query: '' },
    { id: 'categories', labelKey: 'carnetSegmentsCategories', query: '?segment=categories' },
    { id: 'allergens', labelKey: 'carnetSegmentsAllergenes', query: '?segment=allergens' },
    { id: 'stats', labelKey: 'carnetSegmentsBilan', query: '?segment=stats' }
  ];
</script>

<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';
  import { localizedHref } from '$lib/utils/localized-href';

  let {
    childId,
    currentSegment
  }: { childId: string; currentSegment: Segment } = $props();
</script>

<nav
  aria-label={m.carnetSegmentsAriaLabel()}
  class="mb-3 flex gap-1 rounded-full border border-border/40 bg-canvas p-1"
>
  {#each SEGMENTS as seg (seg.id)}
    {@const active = seg.id === currentSegment}
    <a
      href={localizedHref(`/child/${childId}/foods${seg.query}`)}
      aria-current={active ? 'page' : undefined}
      data-sveltekit-noscroll
      data-sveltekit-keepfocus
      data-sveltekit-replacestate
      class={cn(
        'flex min-h-11 flex-1 items-center justify-center rounded-full px-3 text-center text-xs font-semibold transition-colors duration-base ease-soft active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active ? 'bg-primary text-primary-foreground' : 'text-ink-soft hover:text-foreground'
      )}
    >
      {m[seg.labelKey]()}
    </a>
  {/each}
</nav>
