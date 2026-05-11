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
          class="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-soft"
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
          class="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-soft"
        >
          {m.aujourdhuiHeroEmptyCta()}
        </button>
      {/if}
    </div>
  {/key}
</section>
