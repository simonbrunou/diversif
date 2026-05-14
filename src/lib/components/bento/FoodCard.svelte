<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  type Status = 'ras' | 'inconfort' | 'reaction' | 'todo';
  let {
    name,
    category,
    tried,
    status,
    href
  }: { name: string; category: string; tried: number; status: Status; href?: string } = $props();

  const isUntried = $derived(tried === 0);
  const isLinkable = $derived((status === 'inconfort' || status === 'reaction') && !!href);
  const baseClass = $derived(
    cn(
      'flex flex-col gap-1 rounded-tile bg-canvas p-3 shadow-soft',
      isLinkable
        ? 'border border-border/40 transition-transform duration-base ease-soft active:scale-[0.99]'
        : isUntried
          ? 'border border-dashed border-border'
          : 'border border-border/40'
    )
  );
</script>

{#snippet body()}
  <p class="text-sm font-bold leading-tight">{name}</p>
  <p class="text-xs text-ink-soft">
    {isUntried ? m.carnetFoodCardUntried() : m.carnetFoodCardTried({ count: String(tried) })}
  </p>
{/snippet}

{#if isLinkable && href}
  <a {href} class={baseClass} data-category={category} data-status={status}>
    {@render body()}
  </a>
{:else}
  <article class={baseClass} data-category={category} data-status={status}>
    {@render body()}
  </article>
{/if}
