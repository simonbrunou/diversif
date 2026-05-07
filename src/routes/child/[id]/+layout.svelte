<script lang="ts">
  import type { Snippet } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import QueueBadge from '$lib/components/QueueBadge.svelte';
  import InstallPrompt from '$lib/components/InstallPrompt.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

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
