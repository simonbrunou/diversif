<!--
  Sticky in-app back header for sub-screens. Pressing the arrow prefers
  history.back() when there is a referrer (so the user lands on the actual
  page they came from, scrolled to the row they tapped); otherwise it
  navigates to the localized fallback. The fallback is what makes the
  control survive direct hits or fresh tabs.
-->
<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { localizedHref } from '$lib/utils/localized-href';
  import * as m from '$lib/paraglide/messages';

  let {
    title,
    fallback = '/account'
  }: { title?: string; fallback?: string } = $props();

  function back() {
    if (browser && window.history.length > 1) {
      history.back();
      return;
    }
    void goto(localizedHref(fallback));
  }
</script>

<header
  data-no-print
  class="-mx-3 mb-4 flex items-center gap-3 border-b border-border bg-background/85 px-3 py-2 backdrop-blur"
>
  <button
    type="button"
    onclick={back}
    aria-label={m.chromeBack()}
    class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-2 hover:text-foreground active:scale-95"
  >
    <ArrowLeft size={20} aria-hidden="true" />
  </button>
  {#if title}
    <h1 class="font-display text-xl italic leading-tight">{title}</h1>
  {/if}
</header>
