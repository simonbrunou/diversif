<script lang="ts">
  import type { Snippet } from 'svelte';
  import { goto, afterNavigate } from '$app/navigation';
  import { localizedHref } from '$lib/utils/localized-href';
  import Button from '$lib/components/ui/Button.svelte';
  import BottomNavBento, { TABS } from './BottomNavBento.svelte';
  import FabLog from './FabLog.svelte';
  import ChildHeaderPill from './ChildHeaderPill.svelte';
  import ChildSwitcherDrawer from './ChildSwitcherDrawer.svelte';
  import SharedTopBar from './SharedTopBar.svelte';
  import { cn } from '$lib/utils/cn';
  import * as m from '$lib/paraglide/messages';

  type Child = { id: string; name: string; birthMonth: string; avatarSeed: string };

  let {
    user: _user,
    kids,
    currentChildId,
    currentPath,
    children
  }: {
    user?: { email: string };
    kids: Child[];
    currentChildId?: string;
    currentPath: string;
    children?: Snippet;
  } = $props();

  let switcherOpen = $state(false);

  const inChildArea = $derived(!!currentChildId && currentPath.startsWith('/child/'));
  const showChrome = $derived(inChildArea || currentPath === '/account');
  const currentChild = $derived(kids.find((k) => k.id === currentChildId));
  // On /account there's no currentChildId in the URL, but the user still
  // expects the nav + log entry. Fall back to the first kid so tab links
  // and the log button have a target. ChildHeaderPill keeps using
  // `currentChild` so the pill stays hidden on /account.
  const navChildId = $derived(currentChildId ?? kids[0]?.id);
  // Single visibility rule for the rail tabs, mobile nav/FAB and desktop log
  // CTA — they must never disagree (the rail once used currentChildId while
  // the mobile nav used the fallback, leaving desktop /account chrome-less).
  const showNav = $derived(showChrome && !!navChildId);
  // /child/[id]/report is a hand-to-pediatrician document: the fixed desktop
  // « + Enregistrer un aliment » button overlaps the document at lg widths
  // and the mobile FAB floats over it — both are off-context there. The nav
  // (rail + bottom tabs) stays for wayfinding; only the log CTAs go.
  const isReportRoute = $derived(/^\/child\/[^/]+\/report(?:\/|$)/.test(currentPath));
  const showLogCta = $derived(showNav && !isReportRoute);

  let scrollEl: HTMLElement | null = $state(null);

  afterNavigate(() => {
    scrollEl?.scrollTo({ top: 0, behavior: 'instant' });
  });

  function openLog(): void {
    if (!navChildId) return;
    // localizedHref so an EN visitor isn't flipped back to the FR UI.
    void goto(localizedHref(`/child/${navChildId}/log`));
  }
</script>

<div class="grid min-h-screen lg:grid-cols-[220px_1fr]">
  <!-- Desktop left rail sidebar -->
  <nav
    data-no-print
    aria-label={m.chromeLateralNavLabel()}
    class="hidden lg:flex lg:flex-col lg:gap-2 lg:border-r lg:border-border lg:bg-surface lg:p-4"
  >
    <!-- Wordmark links home so chrome-less pages (/child/new) keep a way out
         on desktop, matching the mobile SharedTopBar brand link. -->
    <a href={localizedHref('/')} class="mb-4 font-display text-2xl italic">diversif</a>
    {#if showNav}
      {#each TABS as tab (tab.labelKey)}
        {@const active = tab.matcher(currentPath)}
        <a
          href={tab.href(navChildId)}
          aria-current={active ? 'page' : undefined}
          class={cn(
            'flex items-center gap-3 rounded-tile px-3 py-2 text-sm font-medium transition-colors',
            active ? 'bg-surface-2 text-primary-strong' : 'text-ink-soft hover:bg-surface-2 hover:text-foreground'
          )}
        >
          <tab.icon size={18} aria-hidden="true" />
          {m[tab.labelKey]()}
        </a>
      {/each}
    {/if}
  </nav>

  <!-- On mobile this column must fill the viewport so the bottom nav sits
       flush at the bottom edge of the screen. flex-1 on the scrollable
       content area then fills all available space above the nav, so short
       pages never leave a gap between content and nav. lg:min-h-0 disables
       the fixed height on desktop where the grid tracks handle it. -->
  <div class="flex min-h-dvh flex-col lg:min-h-0">
    <!-- Mobile brand strip via the shared component, so the chrome
         signature matches PublicHeader exactly across the marketing
         to app boundary. Hidden on lg: the left rail carries the brand
         on desktop. -->
    <SharedTopBar class="lg:hidden" />

    <!-- Scrollable content area fills the space between the top bar and nav -->
    <div
      bind:this={scrollEl}
      class="flex-1 overflow-y-auto"
      data-variant="responsive"
    >
      <div class="mx-auto w-full max-w-md px-3 pb-4 pt-3 lg:max-w-3xl lg:pb-3">
        {#if showChrome && currentChild}
          <div data-no-print>
            <ChildHeaderPill child={currentChild} onSwitch={() => (switcherOpen = true)} />
          </div>
        {/if}

        <main id="main" class="flex-1">
          <!-- Screen-reader anchor: every app-shell route lands here, and the
               bento sub-pages start at h2, so AT users need an h1 above to
               know where they are. Visually hidden — ChildHeaderPill and
               page hero copy carry the visual heading. -->
          {#if currentPath === '/account'}
            <h1 class="sr-only">{m.authAccountHeading()}</h1>
          {:else if currentChild}
            <h1 class="sr-only">{currentChild.name}</h1>
          {/if}
          {#if children}{@render children()}{/if}
        </main>
      </div>
    </div>

    {#if showNav}
      <!-- Bottom nav is in normal document flow (not fixed/floating) so it
           sits flush below the scrollable content rather than overlaying it.
           The FAB stays fixed so it can float over the nav's centre slot. -->
      <div data-no-print class="lg:hidden">
        <BottomNavBento currentChildId={navChildId} {currentPath} />
        {#if showLogCta}
          <!-- FAB at bottom-SAI centres it on the nav's 56px visual band
               (SAI+30px ≈ SAI+28px band centre, 2px above). -->
          <div class="fixed bottom-[env(safe-area-inset-bottom)] left-1/2 z-40 -translate-x-1/2">
            <FabLog onclick={openLog} />
          </div>
        {/if}
      </div>

      <ChildSwitcherDrawer bind:open={switcherOpen} {kids} currentChildId={navChildId} />
    {/if}
  </div>

  <!-- Desktop top-right log button -->
  {#if showLogCta}
    <Button
      type="button"
      size="pill"
      data-no-print
      onclick={openLog}
      class="fixed right-4 top-4 z-30 hidden shadow-soft lg:flex lg:items-center lg:gap-1"
    >
      + {m.chromeFabLog()}
    </Button>
  {/if}
</div>
