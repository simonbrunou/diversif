<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  type PillItem = { id: string; label: string; state: 'ok' | 'todo' };

  let {
    items,
    foodsHref
  }: { items: PillItem[]; foodsHref: string } = $props();
</script>

<a
  href={foodsHref}
  class="mb-3 block rounded-tile bg-tile-sky p-4 shadow-soft transition-transform duration-base ease-soft hover:scale-[1.01] active:scale-[0.99]"
>
  <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">
    {m.aujourdhuiAllergensTitle()}
  </p>
  <ul class="-mb-1 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1">
    {#each items as item (item.id)}
      <li
        class={cn(
          'inline-flex shrink-0 snap-start items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
          item.state === 'ok'
            ? 'border-success/40 bg-canvas text-success-foreground'
            : 'border-border bg-canvas text-ink-soft'
        )}
      >
        <span>{item.label}</span>
        <span class="text-[10px]">
          · {item.state === 'ok' ? m.aujourdhuiAllergensOk() : m.aujourdhuiAllergensTodo()}
        </span>
      </li>
    {/each}
  </ul>
</a>
