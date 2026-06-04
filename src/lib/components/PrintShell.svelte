<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import * as m from '$lib/paraglide/messages';
  import { Printer } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let {
    title,
    toolbarStart,
    children
  }: {
    /** Full <title> string. Each route owns its own framing (handoff, fiche, …). */
    title: string;
    /** Optional content rendered on the left of the toolbar (e.g. a back link). */
    toolbarStart?: Snippet;
    children: Snippet;
  } = $props();

  function printPage(): void {
    if (typeof window !== 'undefined') window.print();
  }
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div
  class="mx-auto w-full px-4 max-w-4xl space-y-6 py-6 print:max-w-none print:py-0 print:text-[12px] print:text-black"
>
  <div class="flex items-center justify-between print:hidden">
    <span>
      {#if toolbarStart}{@render toolbarStart()}{/if}
    </span>
    <Button variant="outline" onclick={printPage}>
      <Printer size={16} aria-hidden="true" />
      {m.reportPrintButton()}
    </Button>
  </div>

  {@render children()}
</div>

<style>
  @media print {
    @page {
      size: A4;
      margin: 14mm 12mm;
    }
    :global(html),
    :global(body) {
      background: #fff !important;
      color: #000 !important;
      font-size: 11pt;
    }
    :global(a) {
      color: inherit !important;
      text-decoration: none !important;
    }
    /* Hide app chrome (top bar, sidebar, bottom nav, FAB, desktop log button)
       wired by AppShellBento / SharedTopBar / BackHeader via the
       `[data-no-print]` attribute. Without this every printed page would
       include the entire bento shell. */
    :global([data-no-print]) {
      display: none !important;
    }
    /* Keep each <section> on a single page by default; the two current
       consumers wrap each logical block (stats, allergens, foods, …) in a
       <section> precisely so they don't split. A consumer with a long
       inherently-paginable section should override locally with
       `break-inside: auto`. */
    :global(section) {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
</style>
