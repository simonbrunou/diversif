<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';
  import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-svelte';
  import type { FactCard } from '$lib/content/did-you-know';

  let { cards }: { cards: readonly FactCard[] } = $props();

  let index = $state(0);
  const total = $derived(cards.length);
  const current = $derived(cards[index] ?? null);

  function prev() {
    if (total === 0) return;
    index = (index - 1 + total) % total;
  }
  function next() {
    if (total === 0) return;
    index = (index + 1) % total;
  }
</script>

{#if current}
  <section class="mb-3">
    <SectionHeader>{m.didYouKnowTitle()}</SectionHeader>
    <p class="-mt-1 mb-3 text-xs text-ink-soft">{m.didYouKnowSubtitle()}</p>

    <article
      class="rounded-tile border border-tile-sky-foreground/20 bg-tile-sky/40 p-4 shadow-soft"
      aria-live="polite"
    >
      <div class="flex items-start gap-3">
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tile-sky text-tile-sky-foreground"
        >
          <Sparkles size={18} aria-hidden="true" />
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-bold leading-tight">{current.title}</h3>
          <p class="mt-2 text-sm leading-relaxed text-foreground/90">{current.body}</p>
          <div class="mt-3">
            <SourceCitation ids={current.sources} inline />
          </div>
        </div>
      </div>

      {#if total > 1}
        <div
          class="mt-3 flex items-center justify-between gap-3 border-t border-tile-sky-foreground/15 pt-3"
        >
          <button
            type="button"
            onclick={prev}
            aria-label={m.didYouKnowPrevAria()}
            class={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-ink-soft transition-transform duration-fast ease-soft active:scale-[0.95]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <span
            class="text-[11px] uppercase tracking-wide text-ink-soft"
            aria-label={m.didYouKnowPositionAria({
              current: String(index + 1),
              total: String(total)
            })}
          >
            {index + 1} / {total}
          </span>
          <button
            type="button"
            onclick={next}
            aria-label={m.didYouKnowNextAria()}
            class={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-ink-soft transition-transform duration-fast ease-soft active:scale-[0.95]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      {/if}
    </article>
  </section>
{/if}
