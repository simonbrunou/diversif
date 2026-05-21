<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import AllergenInfoDialog from '$lib/components/AllergenInfoDialog.svelte';
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';
  import {
    PRIORITY_INTRODUCTION_ALLERGENS,
    type AllergenId
  } from '$lib/utils/allergens';
  import type { AllergenItem } from '$lib/server/guidance/allergen-status';
  import { CheckCircle2, AlertTriangle, RefreshCw, Sparkles } from 'lucide-svelte';

  let { allergens }: { allergens: AllergenItem[] } = $props();

  const PRIORITY_SET = new Set<string>(PRIORITY_INTRODUCTION_ALLERGENS);
  const priority = $derived(allergens.filter((a) => PRIORITY_SET.has(a.id)));
  const other = $derived(allergens.filter((a) => !PRIORITY_SET.has(a.id)));
  const introducedCount = $derived(
    priority.filter((a) => a.state === 'cleared' || a.state === 'fading').length
  );

  let openId = $state<AllergenId | null>(null);

  function stateLabel(s: AllergenItem['state']): string {
    if (s === 'cleared') return m.allergenPassportStateCleared();
    if (s === 'todo') return m.allergenPassportStateTodo();
    if (s === 'fading') return m.allergenPassportStateFading();
    return m.allergenPassportStateReaction();
  }

  function stateIcon(s: AllergenItem['state']) {
    if (s === 'cleared') return CheckCircle2;
    if (s === 'todo') return Sparkles;
    if (s === 'fading') return RefreshCw;
    return AlertTriangle;
  }

  function triedCaption(item: AllergenItem): string {
    if (item.triedCount === 0) return m.allergenPassportTriedFirst();
    return m.allergenPassportTriedCount({ count: String(item.triedCount) });
  }

  function open(id: string) {
    openId = id as AllergenId;
  }
</script>

<section class="mb-3">
  <SectionHeader>{m.allergenPassportTitle()}</SectionHeader>
  <p class="-mt-1 mb-3 text-xs text-ink-soft">
    {m.allergenPassportSubtitle({ introduced: String(introducedCount), total: String(priority.length) })}
  </p>

  <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
    {m.allergenPassportSectionPriority()}
  </p>
  <ul class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
    {#each priority as item (item.id)}
      {@const Icon = stateIcon(item.state)}
      <li>
        <button
          type="button"
          onclick={() => open(item.id)}
          class={cn(
            'flex w-full flex-col items-start gap-1 rounded-tile border border-border/40 bg-canvas p-3 text-left shadow-soft transition-transform duration-fast ease-soft active:scale-[0.98]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            item.state === 'cleared' && 'border-success/40',
            item.state === 'fading' && 'border-tile-butter-foreground/30 bg-tile-butter/30',
            item.state === 'reaction' && 'border-severe/40 bg-reaction-reaction/20',
            item.state === 'todo' && 'border-dashed'
          )}
          aria-label={`${item.label} — ${stateLabel(item.state)}`}
        >
          <span class="flex w-full items-center justify-between">
            <span class="text-sm font-bold leading-tight">{item.label}</span>
            <Icon
              size={14}
              aria-hidden="true"
              class={cn(
                item.state === 'cleared' && 'text-success',
                item.state === 'fading' && 'text-tile-butter-foreground',
                item.state === 'reaction' && 'text-severe',
                item.state === 'todo' && 'text-ink-soft'
              )}
            />
          </span>
          <span class="text-[11px] uppercase tracking-wide text-ink-soft">
            {stateLabel(item.state)}
          </span>
          <span class="text-xs text-ink-soft">
            {#if item.state === 'fading' && item.daysSinceLastTried !== null}
              {m.allergenPassportFadingHint({ days: String(item.daysSinceLastTried) })}
            {:else}
              {triedCaption(item)}
            {/if}
          </span>
        </button>
      </li>
    {/each}
  </ul>

  <p class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
    {m.allergenPassportSectionOther()}
  </p>
  <ul class="-mx-1 flex flex-wrap gap-1.5 px-1">
    {#each other as item (item.id)}
      <li>
        <button
          type="button"
          onclick={() => open(item.id)}
          class={cn(
            'inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            item.state === 'cleared' && 'border-success/40 bg-canvas text-success',
            item.state === 'todo' && 'border-border border-dashed bg-canvas text-ink-soft',
            item.state === 'reaction' && 'border-severe/40 bg-reaction-reaction/20 text-severe-foreground',
            item.state === 'fading' && 'border-tile-butter-foreground/30 bg-tile-butter/30 text-tile-butter-foreground'
          )}
        >
          <span>{item.label}</span>
          <span class="text-[10px] text-ink-soft">· {stateLabel(item.state)}</span>
        </button>
      </li>
    {/each}
  </ul>
</section>

<AllergenInfoDialog bind:allergenId={openId} />
