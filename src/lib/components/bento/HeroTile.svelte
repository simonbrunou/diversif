<!-- src/lib/components/bento/HeroTile.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { SuggestFood } from '$lib/utils/suggest';

  let {
    childName,
    suggestion,
    onLog
  }: {
    childName: string;
    suggestion: SuggestFood | null;
    onLog: (food: SuggestFood | null) => void;
  } = $props();

  // Debounce the CTA after each suggestion change to swallow stray taps
  // landing on the just-rendered tile (the suggestion can change mid-tap
  // and the captured value would be stale).
  let pending = $state(false);
  let pendingTimer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    void suggestion?.id;
    pending = true;
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => (pending = false), 200);
    return () => clearTimeout(pendingTimer);
  });
</script>

<section
  class="relative mb-3 overflow-hidden rounded-hero bg-tile-peach p-5 shadow-soft"
  aria-labelledby="hero-title"
>
  {#key suggestion?.id ?? 'empty'}
    <div class="animate-fade-in-soft">
      {#if suggestion}
        <h2 id="hero-title" class="font-display text-2xl italic leading-tight">
          {m.aujourdhuiHeroSuggestionTitle({ food: suggestion.name })}
        </h2>
        <button
          type="button"
          onclick={() => onLog(suggestion)}
          disabled={pending}
          class="mt-4 inline-flex min-h-11 items-center rounded-full border border-primary/50 bg-surface px-4 text-sm font-semibold text-primary-strong transition-colors hover:bg-surface-2"
          class:opacity-60={pending}
        >
          {m.aujourdhuiHeroSuggestionCta({ food: suggestion.name })}
        </button>
      {:else}
        <h2 id="hero-title" class="font-display text-2xl italic leading-tight">
          {m.aujourdhuiHeroEmptyTitle({ name: childName })}
        </h2>
        <p class="mt-2 text-sm text-ink-soft">{m.aujourdhuiHeroEmptyBody()}</p>
        <button
          type="button"
          onclick={() => onLog(null)}
          disabled={pending}
          class="mt-4 inline-flex min-h-11 items-center rounded-full border border-primary/50 bg-surface px-4 text-sm font-semibold text-primary-strong transition-colors hover:bg-surface-2"
          class:opacity-60={pending}
        >
          {m.aujourdhuiHeroEmptyCta()}
        </button>
      {/if}
    </div>
  {/key}
</section>
