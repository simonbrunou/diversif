<script lang="ts" module>
  export type AllergenPillState = 'ok' | 'todo' | 'fading' | 'inconfort' | 'reaction';

  // Peach is now RESERVED for 'reaction' inside this tile. It used to be
  // shared with 'fading', and the two shades sat 1.02:1 apart with an
  // identical foreground — so "your baby reacted to sesame" and "re-offer
  // egg sometime" rendered as the same pill, and the one datum that should
  // change a parent's evening had no rank at all. 'fading' now borrows the
  // butter pair (the brief's own token for reminders) at tile strength.
  const PILL_CLASSES: Record<AllergenPillState, string> = {
    ok: 'bg-tile-mint text-tile-mint-foreground',
    todo: 'bg-surface text-ink-soft',
    fading: 'bg-tile-butter text-tile-butter-foreground',
    // The border here encodes state (the only visual difference from
    // 'todo' once both are white on bg-surface), not elevation — do not
    // remove it as a "redundant" Single Channel violation.
    inconfort: 'border border-tile-butter-foreground/50 bg-surface text-tile-butter-foreground',
    reaction: 'bg-reaction-reaction text-reaction-reaction-foreground'
  };
</script>

<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';
  import { ChevronRight } from 'lucide-svelte';

  type PillItem = {
    id: string;
    label: string;
    state: AllergenPillState;
    /** Entry page for this allergen's worst reaction, when there is one. */
    href?: string;
  };

  let {
    items,
    clearedCount = 0,
    foodsHref
  }: { items: PillItem[]; clearedCount?: number; foodsHref: string } = $props();

  function stateLabel(state: AllergenPillState): string {
    if (state === 'ok') return m.aujourdhuiAllergensOk();
    if (state === 'fading') return m.aujourdhuiAllergensFading();
    if (state === 'inconfort') return m.reactionsLabelInconfort();
    if (state === 'reaction') return m.aujourdhuiAllergensReaction();
    return m.aujourdhuiAllergensTodo();
  }

  const clearedLabel = $derived(
    clearedCount === 1
      ? m.aujourdhuiAllergensClearedOne()
      : m.aujourdhuiAllergensClearedOther({ count: String(clearedCount) })
  );
</script>

<!--
  This tile used to be one big <a> wrapping an `overflow-x-auto` <ul>. Three
  problems, all measured: axe flagged `scrollable-region-focusable` (serious)
  because Safari and Firefox do not make scroll containers focusable, so the
  hidden pills were keyboard-unreachable on the product's primary platform;
  911px of pills lived in a 334px box with no fade, scrollbar or chevron, so
  the third pill rendered clipped mid-word; and the anchor's accessible name
  was the entire concatenation of every pill. It is now a plain section whose
  heading carries the link, and the pills wrap.
-->
<section
  aria-labelledby="allergens-snapshot-title"
  class="mb-3 rounded-tile bg-tile-sky p-4 text-tile-sky-foreground shadow-soft"
>
  <!-- flex-wrap so that at a 195px viewport (200% zoom) the "Tout voir" link
       drops below the heading instead of the tracked uppercase title being
       broken mid-word. No effect at any real device width. -->
  <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
    <!-- min-w-0: a flex child will not shrink below its content width, so the
         tracked uppercase heading pushed the "Tout voir" link 28px outside the
         tile at a 195px viewport (200% zoom) instead of wrapping. -->
    <h2
      id="allergens-snapshot-title"
      class="min-w-0 text-2xs font-semibold uppercase tracking-[0.08em]"
    >
      {m.aujourdhuiAllergensTitle()}
    </h2>
    <a
      href={foodsHref}
      class="inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded px-1 text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {m.aujourdhuiAllergensSeeAll()}
      <ChevronRight size={14} aria-hidden="true" />
    </a>
  </div>

  {#if items.length === 0}
    <p class="mt-1 text-sm">{m.aujourdhuiAllergensEmpty()}</p>
  {:else}
    <!--
      32px chips with 8px separation, not 44px. WCAG 2.5.8 (AA) sets the floor
      at 24x24; 2.5.5's 44px is AAA and is reserved here for the tile's own
      heading link, the feed rows and the FAB. At 44px these chips wrapped to
      three 44px rows and pushed the recent feed — the parent's actual data —
      below the fold on a 390x844 screen, which is a worse outcome than a
      32px chip for a secondary affordance.
    -->
    <ul class="mt-1 flex flex-wrap gap-2">
      {#each items as item (item.id)}
        <li>
          {#if item.href}
            <!-- A pill with a reaction behind it links straight at that entry:
                 the page that carries "Respirez" and the 15/112 rail. Before,
                 the whole tile went to the allergen segment index, so after
                 the 48h observation reminder expired a parent had no route
                 from the dashboard back to the reassurance copy. -->
            <a
              href={item.href}
              aria-label={m.aujourdhuiAllergensEntryAria({ allergen: item.label })}
              class={cn(
                'inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-xs font-medium transition-transform duration-base ease-soft active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                PILL_CLASSES[item.state]
              )}
            >
              <span>{item.label}</span>
              <span class="text-2xs opacity-90">· {stateLabel(item.state)}</span>
            </a>
          {:else}
            <span
              class={cn(
                'inline-flex min-h-8 items-center gap-1 rounded-full px-3 text-xs font-medium',
                PILL_CLASSES[item.state]
              )}
            >
              <span>{item.label}</span>
              <span class="text-2xs opacity-90">· {stateLabel(item.state)}</span>
            </span>
          {/if}
        </li>
      {/each}
    </ul>
    {#if clearedCount > 0}
      <!-- The already-cleared allergens are reassurance, not a to-do. Stating
           them as a count keeps the pill row down to the actionable states
           instead of pushing them off the edge of a scroller. -->
      <p class="mt-2 text-xs">{clearedLabel}</p>
    {/if}
  {/if}
</section>
