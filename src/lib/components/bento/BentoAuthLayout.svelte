<script lang="ts">
  import type { Snippet } from 'svelte';
  import BentoMark from './BentoMark.svelte';

  let {
    title,
    subtitle,
    children
  }: { title: string; subtitle: string; children: Snippet } = $props();
</script>

<div
  // fallow-ignore-next-line css-token-drift -- the bottom padding adds the device safe-area inset, which no theme token can express
  class="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-tile-peach via-tile-butter to-canvas px-4 py-12 pb-[calc(3rem+env(safe-area-inset-bottom))]"
>
  <article class="w-full max-w-md rounded-hero bg-surface px-6 py-8 shadow-lifted">
    <BentoMark size={44} class="mb-5" />
    <h1 class="font-display text-3xl italic leading-tight">{title}</h1>
    {#if subtitle}
      <p class="mt-2 text-sm text-ink-soft">{subtitle}</p>
    {/if}
    <div class="mt-6">
      {@render children()}
    </div>
  </article>
</div>
