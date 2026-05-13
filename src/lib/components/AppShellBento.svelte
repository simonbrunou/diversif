<script lang="ts">
  import type { Snippet } from 'svelte';
  import BottomNavBento, { TABS } from './BottomNavBento.svelte';
  import FabLog from './FabLog.svelte';
  import ChildHeaderPill from './ChildHeaderPill.svelte';
  import ChildSwitcherDrawer from './ChildSwitcherDrawer.svelte';
  import LogSheet from './LogSheet.svelte';
  import { cn } from '$lib/utils/cn';
  import * as m from '$lib/paraglide/messages';

  type Child = { id: string; name: string; birthMonth: string; avatarSeed: string };

  let {
    user: _user,
    kids,
    currentChildId,
    currentPath,
    foods,
    children
  }: {
    user?: { email: string };
    kids: Child[];
    currentChildId?: string;
    currentPath: string;
    foods: { id: string; label: string }[];
    children?: Snippet;
  } = $props();

  let logOpen = $state(false);
  let switcherOpen = $state(false);

  const inChildArea = $derived(!!currentChildId && currentPath.startsWith('/child/'));
  const showChrome = $derived(inChildArea || currentPath === '/account');
  const currentChild = $derived(kids.find((k) => k.id === currentChildId));
  // On /account there's no currentChildId in the URL, but the user still
  // expects the nav + FAB. Fall back to the first kid so tab links and the
  // log sheet have a target. ChildHeaderPill keeps using `currentChild` so
  // the pill stays hidden on /account.
  const navChildId = $derived(currentChildId ?? kids[0]?.id);
  const navChild = $derived(kids.find((k) => k.id === navChildId));
</script>

<div class="grid min-h-screen lg:grid-cols-[220px_1fr]">
  <!-- Desktop left rail sidebar -->
  <nav
    aria-label="Navigation latérale"
    class="hidden lg:flex lg:flex-col lg:gap-2 lg:border-r lg:border-border lg:bg-surface lg:p-4"
  >
    <span class="mb-4 font-display text-2xl italic">diversif</span>
    {#if currentChildId}
      {#each TABS as tab (tab.labelKey)}
        {@const active = tab.matcher(currentPath)}
        <a
          href={tab.href(currentChildId)}
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

  <div class="flex flex-col">
    <!-- Mobile brand strip — bridges the visual gap to PublicHeader.
         Same h-14, border-b, backdrop-blur signature so the chrome
         doesn't fully swap when moving between marketing and app. -->
    <header
      class="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/85 px-3 backdrop-blur lg:hidden"
    >
      <a
        href="/"
        class="inline-flex items-center gap-2 font-semibold text-foreground"
        aria-label={m.chromePublicHeaderBrand()}
      >
        <img src="/favicon.svg" alt="" class="h-7 w-7" aria-hidden="true" />
        <span>{m.chromePublicHeaderBrand()}</span>
      </a>
    </header>

    <!-- Main content area (mobile + desktop right column) -->
    <div class="mx-auto w-full max-w-md px-3 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-3 lg:max-w-3xl lg:pb-3" data-variant="responsive">
      {#if showChrome && currentChild}
        <ChildHeaderPill child={currentChild} onSwitch={() => (switcherOpen = true)} />
      {/if}

      <main id="main" class="flex-1">
        {#if children}{@render children()}{/if}
      </main>

      {#if showChrome && navChildId}
        <!-- Mobile bottom nav + FAB (hidden on desktop). FAB is centered
             vertically on the nav's center (bottom-[calc(0.625rem+safe)] puts
             its 60px circle around the nav's center at 40px+safe), filling the
             `w-16` spacer slot in BottomNavBento between tabs 2 and 3. -->
        <div class="lg:hidden">
          <BottomNavBento currentChildId={navChildId} {currentPath} />
          <div class="fixed bottom-[calc(0.625rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2">
            <FabLog onclick={() => (logOpen = true)} />
          </div>
        </div>

        <!-- Shared overlays -->
        <ChildSwitcherDrawer bind:open={switcherOpen} {kids} currentChildId={navChildId} />
        <LogSheet
          bind:open={logOpen}
          childId={navChildId}
          childName={navChild?.name ?? ''}
          {foods}
        />
      {/if}
    </div>
  </div>

  <!-- Desktop top-right log button -->
  {#if showChrome && currentChildId}
    <button
      type="button"
      onclick={() => (logOpen = true)}
      class="fixed right-4 top-4 z-30 hidden rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-soft lg:flex lg:items-center lg:gap-1"
    >
      + {m.chromeFabLog()}
    </button>
  {/if}
</div>
