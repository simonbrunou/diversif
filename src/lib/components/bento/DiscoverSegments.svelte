<script lang="ts" module>
  export type DiscoverSection = 'reperes' | 'essayer' | 'apprendre';

  type Entry = {
    id: DiscoverSection;
    labelKey: 'discoverGroupReperes' | 'discoverGroupAEssayer' | 'discoverGroupApprendre';
    query: string;
  };

  export const SECTIONS: Entry[] = [
    { id: 'reperes', labelKey: 'discoverGroupReperes', query: '' },
    { id: 'essayer', labelKey: 'discoverGroupAEssayer', query: '?section=essayer' },
    { id: 'apprendre', labelKey: 'discoverGroupApprendre', query: '?section=apprendre' }
  ];
</script>

<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';
  import { localizedHref } from '$lib/utils/localized-href';

  let {
    childId,
    currentSection
  }: { childId: string; currentSection: DiscoverSection } = $props();
</script>

<nav
  aria-label={m.decouvrirSegmentsAriaLabel()}
  class="mb-4 flex gap-1 rounded-full border border-border/40 bg-canvas p-1"
>
  {#each SECTIONS as seg (seg.id)}
    {@const active = seg.id === currentSection}
    <a
      href={localizedHref(`/child/${childId}/guide${seg.query}`)}
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
