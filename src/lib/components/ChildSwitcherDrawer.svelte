<script lang="ts">
  import Drawer from './ui/Drawer.svelte';
  import * as m from '$lib/paraglide/messages';
  import { Plus, Check } from 'lucide-svelte';

  type Child = { id: string; name: string; birthMonth: string; avatarSeed: string };

  let {
    open = $bindable(false),
    kids,
    currentChildId
  }: { open: boolean; kids: Child[]; currentChildId: string } = $props();
</script>

<Drawer bind:open side="right">
  <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-soft">
    {m.chromeChildSwitcherTitle()}
  </h2>
  <ul class="mt-3 flex flex-col gap-2">
    {#each kids as child (child.id)}
      <li>
        <a
          href={`/child/${child.id}`}
          class="flex items-center gap-3 rounded-tile border border-border/60 bg-canvas px-3 py-2 hover:bg-surface-2"
          aria-current={child.id === currentChildId ? 'page' : undefined}
          onclick={() => (open = false)}
        >
          <span class="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-tile-peach to-tile-butter">
            {child.avatarSeed}
          </span>
          <span class="flex-1 font-bold">{child.name}</span>
          {#if child.id === currentChildId}
            <Check size={16} class="text-primary" aria-hidden="true" />
          {/if}
        </a>
      </li>
    {/each}
    <li>
      <a
        href="/child/new"
        class="flex items-center gap-3 rounded-tile border border-dashed border-border bg-canvas px-3 py-2 text-ink-soft hover:bg-surface-2"
        onclick={() => (open = false)}
      >
        <span class="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2">
          <Plus size={16} aria-hidden="true" />
        </span>
        <span class="font-semibold">{m.chromeChildSwitcherAdd()}</span>
      </a>
    </li>
  </ul>
</Drawer>
