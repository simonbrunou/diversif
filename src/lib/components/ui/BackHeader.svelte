<!--
  Sticky in-app back header for sub-screens. The arrow prefers
  history.back() when the user reached this page via an in-app navigation
  (so they land on the page they came from, scrolled to the row they
  tapped); on a cold entry it navigates to the localized fallback so a
  direct URL hit, a bookmark, or a tab with unrelated prior history
  doesn't strand the user off-site. window.history.length isn't a
  referrer signal — afterNavigate's `from` is, so we listen for it.
-->
<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';
  import { browser } from '$app/environment';
  import { afterNavigate, goto } from '$app/navigation';
  import { localizedHref } from '$lib/utils/localized-href';
  import * as m from '$lib/paraglide/messages';

  let {
    title,
    subtitle,
    fallback = '/account'
  }: { title?: string; subtitle?: string; fallback?: string } = $props();

  // afterNavigate fires once on initial hydration with from === null, and
  // again with a non-null from for every client-side navigation that
  // followed. So this flag is true iff the user reached the current page
  // by navigating from another page in the same SvelteKit session.
  let arrivedInApp = $state(false);
  afterNavigate((nav) => {
    if (nav.from) arrivedInApp = true;
  });

  function back() {
    if (browser && arrivedInApp) {
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
  {#if title || subtitle}
    <div class="min-w-0 flex-1">
      {#if title}
        <h1 class="font-display text-xl italic leading-tight">{title}</h1>
      {/if}
      {#if subtitle}
        <p class="truncate text-sm text-muted-foreground">{subtitle}</p>
      {/if}
    </div>
  {/if}
</header>
