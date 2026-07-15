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
  class="print-shell mx-auto w-full px-4 max-w-4xl space-y-6 py-6 print:max-w-none print:py-0 print:text-[12px] print:text-black"
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
    /* Report/fiche content (bg-card, text-muted-foreground, bg-muted,
       bg-foreground/70, reaction-* colors, …) resolves its color classes
       through these same-named runtime vars, which `.dark` on <html>
       overrides site-wide. Paper has no dark mode, so pin them back to the
       :root light values for the printed subtree — otherwise a dark-mode
       user prints dark cards / low-contrast text onto white paper. Mirrors
       the light block of :root in app.css. */
    :global(.print-shell) {
      --canvas: 39 67% 97%;
      --background: var(--canvas);
      --foreground: 0 0% 10%;
      --surface: 0 0% 100%;
      --surface-2: 39 50% 91%;
      --card: var(--surface);
      --card-foreground: var(--foreground);
      --popover: var(--surface);
      --popover-foreground: var(--foreground);
      --ink: var(--foreground);
      --ink-soft: 0 0% 32%;
      --muted: var(--surface-2);
      --muted-foreground: var(--ink-soft);
      --border: 39 36% 88%;
      --input: var(--border);
      --ring: 120 14% 49%;
      --primary: 120 14% 49%;
      --primary-foreground: 0 0% 10%;
      --primary-strong: 120 18% 32%;
      --secondary: var(--surface-2);
      --secondary-foreground: var(--foreground);
      --accent: var(--surface-2);
      --accent-foreground: var(--foreground);
      --tile-peach: 27 100% 87%;
      --tile-peach-foreground: 23 88% 22%;
      --tile-butter: 47 100% 84%;
      --tile-butter-foreground: 38 88% 23%;
      --tile-mint: 142 35% 84%;
      --tile-mint-foreground: 142 41% 21%;
      --tile-sky: 213 100% 89%;
      --tile-sky-foreground: 218 62% 26%;
      --tile-lilac: 257 100% 92%;
      --tile-lilac-foreground: 261 56% 27%;
      /* Deliberate literal copy of app.css's :root status vars: print must pin
         the LIGHT values on this element so dark-mode users get light paper
         output; var() indirection would resolve against .dark again. */
      /* fallow-ignore-next-line code-duplication */
      --success: var(--tile-mint);
      --success-foreground: var(--tile-mint-foreground);
      --warning: var(--tile-butter);
      --warning-foreground: var(--tile-butter-foreground);
      --info: var(--tile-sky);
      --info-foreground: var(--tile-sky-foreground);
      --severe: 14 100% 71%;
      --severe-foreground: 14 88% 22%;
      --severe-text: 14 88% 22%;
      --destructive: var(--severe);
      --destructive-foreground: var(--severe-foreground);
      --reaction-ras: var(--tile-mint);
      --reaction-ras-foreground: var(--tile-mint-foreground);
      --reaction-inconfort: var(--tile-butter);
      --reaction-inconfort-foreground: var(--tile-butter-foreground);
      --reaction-reaction: 23 80% 86%;
      --reaction-reaction-foreground: 23 88% 22%;
      --celebrate: var(--tile-butter);
      --celebrate-foreground: var(--tile-butter-foreground);
    }
  }
</style>
