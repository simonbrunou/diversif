<!--
  Top brand strip shared between PublicHeader (marketing/auth-anonymous
  surfaces) and AppShellBento (the logged-in app shell). Same h-14 sticky,
  border-b, backdrop-blur signature so the chrome doesn't fully swap when
  the user moves between marketing and app.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';

  type Props = {
    /** Right-side content of the top bar (nav links, CTAs, hamburger). */
    children?: Snippet;
    /** Content rendered inside the header element below the bar (e.g., mobile dropdown). */
    below?: Snippet;
    class?: string;
  };

  let { children, below, class: className = '' }: Props = $props();
</script>

<header
  data-no-print
  class={cn(
    'sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur',
    className
  )}
>
  <div class="container flex h-14 items-center justify-between gap-4 md:h-16">
    <a
      href={localizedHref('/')}
      class="inline-flex items-center gap-2 font-semibold text-foreground"
    >
      <img src="/favicon.svg" alt="" class="h-7 w-7" aria-hidden="true" />
      <span>{m.chromePublicHeaderBrand()}</span>
    </a>
    {#if children}{@render children()}{/if}
  </div>
  {#if below}{@render below()}{/if}
</header>
