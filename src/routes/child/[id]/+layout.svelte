<script lang="ts">
  import type { Snippet } from 'svelte';
  import AppShell from '$lib/components/AppShell.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<AppShell
  childId={data.child.id}
  childName={data.child.name}
  birthDate={data.child.birthDate}
>
  {@render children()}
</AppShell>
<BottomNav childId={data.child.id} />
