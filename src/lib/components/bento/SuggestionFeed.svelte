<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import type { SuggestFood, RankedSuggestion } from '$lib/utils/suggest';

  let {
    suggestions,
    onPick,
    viewAllHref
  }: {
    suggestions: RankedSuggestion[];
    onPick: (food: SuggestFood) => void;
    viewAllHref?: string;
  } = $props();

  function reasonLabel(r: RankedSuggestion['reason']): string {
    if (r === 'allergen') return m.decouvrirSuggestionReasonAllergen();
    if (r === 'recent') return m.decouvrirSuggestionReasonRecent();
    return m.decouvrirSuggestionReasonDiversify();
  }
</script>

{#if suggestions.length > 0}
  <section class="mb-3">
    <SectionHeader>{m.decouvrirSuggestionsTitle()}</SectionHeader>
    <ul class="flex flex-col gap-2">
      {#each suggestions as s (s.food.id)}
        <li>
          <button
            type="button"
            onclick={() => onPick(s.food)}
            class="flex w-full items-center justify-between rounded-tile bg-tile-lilac px-4 py-3 text-left shadow-soft transition-transform duration-base ease-soft hover:scale-[1.01] active:scale-[0.99]"
          >
            <span class="font-bold">{s.food.name}</span>
            <span class="rounded-full bg-canvas px-2 py-0.5 text-xs font-semibold text-ink-soft">
              {reasonLabel(s.reason)}
            </span>
          </button>
        </li>
      {/each}
    </ul>
    {#if viewAllHref}
      <a
        href={viewAllHref}
        class="mt-2 inline-block text-sm font-semibold text-primary-strong underline-offset-2 hover:underline"
      >
        {m.decouvrirSuggestionsViewAll()} →
      </a>
    {/if}
  </section>
{/if}
