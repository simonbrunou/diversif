<script lang="ts">
  import type { Snippet } from 'svelte';
  import BottomNavBento from './BottomNavBento.svelte';
  import FabLog from './FabLog.svelte';
  import ChildHeaderPill from './ChildHeaderPill.svelte';
  import ChildSwitcherDrawer from './ChildSwitcherDrawer.svelte';
  import LogSheet from './LogSheet.svelte';

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
</script>

<div class="mx-auto flex min-h-screen max-w-md flex-col px-3 pb-20 pt-3" data-variant="mobile">
  {#if showChrome && currentChild}
    <ChildHeaderPill child={currentChild} onSwitch={() => (switcherOpen = true)} />
  {/if}

  <main class="flex-1">
    {#if children}{@render children()}{/if}
  </main>

  {#if showChrome && currentChildId}
    <BottomNavBento {currentChildId} {currentPath} />
    <div class="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <FabLog onclick={() => (logOpen = true)} />
    </div>
    <ChildSwitcherDrawer bind:open={switcherOpen} {kids} {currentChildId} />
    <LogSheet
      bind:open={logOpen}
      childId={currentChildId}
      childName={currentChild?.name ?? ''}
      {foods}
    />
  {/if}
</div>
