<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import EmptyHint from '$components/ui/EmptyHint.svelte';
  import * as m from '$lib/paraglide/messages';
  import { Clock, ChefHat } from 'lucide-svelte';
  import type { Recipe } from '$lib/content/recipes';

  let { recipes }: { recipes: readonly Recipe[] } = $props();

  let openId = $state<string | null>(null);

  function toggle(id: string) {
    openId = openId === id ? null : id;
  }
</script>

<section class="mb-3">
  <SectionHeader>{m.recipesTitle()}</SectionHeader>
  <p class="-mt-1 mb-3 text-xs text-ink-soft">{m.recipesSubtitle()}</p>

  {#if recipes.length === 0}
    <EmptyHint icon={ChefHat} title={m.recipesTitle()}>
      {m.recipesEmpty()}
    </EmptyHint>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each recipes as recipe (recipe.id)}
        {@const expanded = openId === recipe.id}
        <li>
          <button
            type="button"
            onclick={() => toggle(recipe.id)}
            aria-expanded={expanded}
            aria-controls={`recipe-${recipe.id}-ingredients`}
            class="flex w-full flex-col items-start gap-1 rounded-tile border border-border/40 bg-canvas p-3 text-left shadow-soft transition-transform duration-fast ease-soft active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span class="flex w-full items-center justify-between gap-3">
              <span class="min-w-0 flex-1">
                <p class="text-sm font-bold leading-tight">{recipe.title}</p>
                <p class="mt-0.5 text-xs text-ink-soft">{recipe.subtitle}</p>
              </span>
              <span
                class="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-soft"
              >
                <Clock size={10} aria-hidden="true" />
                {m.recipesTimeMinutes({ minutes: String(recipe.timeMinutes) })}
              </span>
            </span>
            {#if expanded}
              <div
                id={`recipe-${recipe.id}-ingredients`}
                class="mt-2 w-full rounded-tile bg-surface-2/60 p-3"
              >
                <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  {m.recipesIngredientsLabel()}
                </p>
                <ul class="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground/90">
                  {#each recipe.ingredients as ing (ing)}
                    <li>{ing}</li>
                  {/each}
                </ul>
              </div>
            {/if}
          </button>
        </li>
      {/each}
    </ul>

    <p class="mt-3 text-[11px] italic text-ink-soft">{m.recipesDisclaimer()}</p>
  {/if}
</section>
