<script lang="ts">
  import CoparentActivity from './CoparentActivity.svelte';
  import DashedActionRow from '$components/ui/DashedActionRow.svelte';
  import EmptyHint from '$components/ui/EmptyHint.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import type { CoparentEntry } from '$lib/server/guidance/queries/timeline';
  import { UserPlus } from 'lucide-svelte';

  type Coparent = { id: string; displayName: string; role: string };

  let {
    childName,
    coparents,
    inviteHref,
    activity = []
  }: {
    childName: string;
    coparents: Coparent[];
    inviteHref: string;
    activity?: CoparentEntry[];
  } = $props();
</script>

<section class="mb-3">
  <SectionHeader>{m.profilCoparentsTitle()} · {childName}</SectionHeader>
  {#if coparents.length === 0}
    <EmptyHint>{m.profilCoparentsEmpty()}</EmptyHint>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each coparents as cp (cp.id)}
        <li class="flex items-center gap-3 rounded-tile bg-surface px-3 py-2 shadow-soft">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-tile-lilac text-xs font-bold">
            {cp.displayName.charAt(0)}
          </span>
          <span class="flex-1 text-sm font-bold">{cp.displayName}</span>
          <span class="text-xs text-ink-soft">{cp.role}</span>
        </li>
      {/each}
    </ul>
  {/if}
  <CoparentActivity {activity} />
  <DashedActionRow href={inviteHref} icon={UserPlus} class="mt-2 flex">
    {m.profilCoparentsInvite()}
  </DashedActionRow>
</section>
