<script lang="ts">
  import type { Snippet } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import QueueBadge from '$lib/components/QueueBadge.svelte';
  import InstallPrompt from '$lib/components/InstallPrompt.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

{#if data.bento}
  <!-- Bento shell (root +layout.svelte) owns all chrome for opted-in users.
       Skip the legacy AppShell + BottomNav so we don't double-render the
       bottom nav — both have aria-label "Navigation principale". -->
  {@render children()}
{:else}
  <div
    class="safe-top sticky top-0 z-30 flex justify-end gap-2 border-b bg-background/95 px-3 py-1.5 backdrop-blur md:hidden"
  >
    <QueueBadge />
    <InstallPrompt />
  </div>

  <AppShell
    childId={data.child.id}
    childName={data.child.name}
    birthDate={data.child.birthDate}
  >
    {@render children()}
  </AppShell>
  <BottomNav childId={data.child.id} />
{/if}
