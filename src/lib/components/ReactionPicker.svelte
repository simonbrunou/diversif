<script lang="ts">
  import { REACTIONS, type ReactionId } from '$lib/utils/reactions';
  import { cn } from '$lib/utils/cn';

  let {
    name,
    value = $bindable<ReactionId>('ras')
  }: { name: string; value?: ReactionId } = $props();

  const STYLES: Record<ReactionId, { bg: string; ring: string; text: string }> = {
    ras: {
      bg: 'bg-reaction-ras/10',
      ring: 'border-reaction-ras ring-reaction-ras/30',
      text: 'text-reaction-ras'
    },
    inconfort: {
      bg: 'bg-reaction-inconfort/10',
      ring: 'border-reaction-inconfort ring-reaction-inconfort/30',
      text: 'text-reaction-inconfort'
    },
    reaction: {
      bg: 'bg-reaction-reaction/10',
      ring: 'border-reaction-reaction ring-reaction-reaction/30',
      text: 'text-reaction-reaction'
    }
  };
</script>

<fieldset class="grid grid-cols-3 gap-2">
  <legend class="sr-only">Réaction</legend>
  {#each REACTIONS as r (r.id)}
    {@const active = value === r.id}
    {@const s = STYLES[r.id]}
    <label
      class={cn(
        'flex cursor-pointer flex-col items-center gap-1 rounded-md border bg-background p-3 text-sm transition-colors hover:bg-accent',
        'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        active && [s.bg, s.ring, s.text, 'border-2 ring-2']
      )}
    >
      <input type="radio" {name} value={r.id} bind:group={value} class="sr-only" />
      <span class="font-medium">{r.label}</span>
      <span class="text-[11px] text-muted-foreground">{r.description}</span>
    </label>
  {/each}
</fieldset>
