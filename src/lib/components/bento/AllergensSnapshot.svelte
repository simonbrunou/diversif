<script lang="ts" module>
  export type AllergenPillState = 'ok' | 'todo' | 'fading' | 'reaction';

  const PILL_CLASSES: Record<AllergenPillState, string> = {
    ok: 'border-success/40 bg-tile-mint text-tile-mint-foreground',
    todo: 'border-border bg-canvas text-ink-soft',
    fading: 'border-tile-peach-foreground/30 bg-tile-peach text-tile-peach-foreground',
    reaction: 'border-severe/40 bg-reaction-reaction text-reaction-reaction-foreground'
  };
</script>

<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  type PillItem = { id: string; label: string; state: AllergenPillState };

  let { items, foodsHref }: { items: PillItem[]; foodsHref: string } = $props();

  function stateLabel(state: AllergenPillState): string {
    if (state === 'ok') return m.aujourdhuiAllergensOk();
    if (state === 'fading') return m.aujourdhuiAllergensFading();
    if (state === 'reaction') return m.aujourdhuiAllergensReaction();
    return m.aujourdhuiAllergensTodo();
  }
</script>

<a
  href={foodsHref}
  class="mb-3 block rounded-tile bg-tile-sky p-4 shadow-soft transition-transform duration-base ease-soft hover:scale-[1.01] active:scale-[0.99]"
>
  <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">
    {m.aujourdhuiAllergensTitle()}
  </p>
  {#if items.length === 0}
    <p class="mt-3 text-sm text-ink-soft">{m.aujourdhuiAllergensEmpty()}</p>
  {:else}
    <ul class="-mb-1 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
      {#each items as item (item.id)}
        <li
          class={cn(
            'inline-flex shrink-0 snap-start items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
            PILL_CLASSES[item.state]
          )}
        >
          <span>{item.label}</span>
          <span class="text-3xs">· {stateLabel(item.state)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</a>
