<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import type { SuggestFood, RankedSuggestion } from '$lib/utils/suggest';

  let {
    suggestions,
    onPick
  }: { suggestions: RankedSuggestion[]; onPick: (food: SuggestFood) => void } = $props();

  function reasonLabel(r: RankedSuggestion['reason']): string {
    if (r === 'allergen') return m.decouvrirSuggestionReasonAllergen();
    if (r === 'recent') return m.decouvrirSuggestionReasonRecent();
    return m.decouvrirSuggestionReasonDiversify();
  }
</script>

{#if suggestions.length > 0}
  <section class="mb-3" aria-label={m.decouvrirSuggestionsTitle()}>
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
      {m.decouvrirSuggestionsTitle()}
    </h2>
    <ul class="flex flex-col gap-2">
      {#each suggestions as s (s.food.id)}
        <li>
          <button
            type="button"
            onclick={() => onPick(s.food)}
            class="flex w-full items-center justify-between rounded-tile bg-tile-lilac px-4 py-3 text-left shadow-soft transition-transform duration-base ease-soft hover:scale-[1.01] active:scale-[0.99]"
          >
            <span class="font-bold">{s.food.name}</span>
            <span class="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink-soft">
              {reasonLabel(s.reason)}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </section>
{/if}
