<script lang="ts">
  import type { Snippet } from 'svelte';
  import { goto, afterNavigate } from '$app/navigation';
  import { localizedHref } from '$lib/utils/localized-href';
  import Button from '$lib/components/ui/Button.svelte';
  import { Plus } from 'lucide-svelte';
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
  // /child/[id]/report is a hand-to-pediatrician document: the rail's log
  // CTA and the mobile FAB both float over the document at their
  // respective widths — both are off-context there. The nav (rail + bottom
  // tabs) stays for wayfinding; only the log CTAs go.
  const isReportRoute = $derived(/^\/child\/[^/]+\/report(?:\/|$)/.test(currentPath));
  const showLogCta = $derived(showNav && !isReportRoute);

  let scrollEl: HTMLElement | null = $state(null);

  afterNavigate((navigation) => {
    // Only reset on pathname changes — segment switches (CarnetSegments uses
    // data-sveltekit-noscroll on same-pathname ?segment= links) must not jump to top.
    if (navigation.from?.url.pathname === navigation.to?.url.pathname) return;
    scrollEl?.scrollTo({ top: 0, behavior: 'instant' });
  });

  function openLog(): void {
    if (!navChildId) return;
    // localizedHref so an EN visitor isn't flipped back to the FR UI.
    void goto(localizedHref(`/child/${navChildId}/log`));
  }
</script>

<div class="grid min-h-screen lg:grid-cols-[220px_1fr]">
  {#if showLogCta}
    <!-- Rendered first in DOM (fixed positioning keeps it visually anchored
         to the nav's centre slot) so keyboard/AT users reach the app's
         single most-used control before the rail, content, and bottom nav
         instead of after all of it. Desktop-hidden: the rail CTA below
         covers lg+. -->
    <div
      data-no-print
      class="fixed bottom-[calc(env(safe-area-inset-bottom)+4px)] left-1/2 z-40 -translate-x-1/2 lg:hidden"
    >
      <FabLog onclick={openLog} />
    </div>
  {/if}
  <!-- Desktop left rail sidebar -->
  <nav
    data-no-print
    aria-label={m.chromeLateralNavLabel()}
    class="hidden lg:flex lg:flex-col lg:gap-2 lg:border-r lg:border-border lg:bg-surface lg:p-4"
  >
    <!-- Wordmark links home so chrome-less pages (/child/new) keep a way out
         on desktop, matching the mobile SharedTopBar brand link. -->
    <a href={localizedHref('/')} class="mb-4 font-display text-2xl italic">diversif</a>
    {#if showLogCta}
      <!-- Desktop's persistent primary action: docked in the rail (not
           floating in the content gutter) and styled as a filled pill so it
           reads as an action, distinct from the plain-text wayfinding links
           below it. -->
      <Button
        type="button"
        onclick={openLog}
        data-no-print
        class="mb-2 flex items-center justify-center gap-2 rounded-full shadow-soft"
      >
        <Plus size={18} aria-hidden="true" />
        {m.chromeFabLog()}
      </Button>
    {/if}
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

  <!-- On mobile this column must be exactly 100dvh so the flex-1 scrollable
       content area gets a bounded height and overflow-y-auto actually clips
       (min-h-dvh lets the column grow past dvh, giving the inner div no upper
       bound and falling back to window scroll). lg:h-auto restores normal
       content-height sizing on desktop where window scroll is expected. -->
  <div class="flex min-w-0 h-dvh flex-col lg:h-auto">
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
      <!-- pb-12 on mobile clears the FAB: it now floats 23px above the nav
           band, so the old pb-4 left the last scrolled row sitting underneath
           it. Desktop has no FAB, hence the lg override. -->
      <div class="mx-auto w-full max-w-md px-3 pb-12 pt-3 lg:max-w-3xl lg:pb-3">
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
           The FAB (rendered earlier in this file, see above) stays fixed so
           it can float over the nav's centre slot regardless of DOM order. -->
      <div data-no-print class="lg:hidden">
        <BottomNavBento currentChildId={navChildId} {currentPath} />
      </div>

      <ChildSwitcherDrawer bind:open={switcherOpen} {kids} currentChildId={navChildId} />
    {/if}
  </div>
</div>
