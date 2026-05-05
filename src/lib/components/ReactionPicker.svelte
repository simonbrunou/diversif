<script lang="ts">
  import { REACTIONS, type ReactionId } from '$lib/utils/reactions';
  import { cn } from '$lib/utils/cn';

  let {
    name,
    value = $bindable<ReactionId>('ras')
  }: { name: string; value?: ReactionId } = $props();

  const STYLES: Record<
    ReactionId,
    { tint: string; tintHover: string; ring: string; text: string }
  > = {
    ras: {
      tint: 'bg-reaction-ras/5 border-reaction-ras/20',
      tintHover: 'hover:bg-reaction-ras/10 hover:border-reaction-ras/30',
      ring: 'border-reaction-ras ring-reaction-ras/30 bg-reaction-ras/10',
      text: 'text-reaction-ras'
    },
    inconfort: {
      tint: 'bg-reaction-inconfort/5 border-reaction-inconfort/20',
      tintHover: 'hover:bg-reaction-inconfort/10 hover:border-reaction-inconfort/30',
      ring: 'border-reaction-inconfort ring-reaction-inconfort/30 bg-reaction-inconfort/10',
      text: 'text-reaction-inconfort'
    },
    reaction: {
      tint: 'bg-reaction-reaction/5 border-reaction-reaction/20',
      tintHover: 'hover:bg-reaction-reaction/10 hover:border-reaction-reaction/30',
      ring: 'border-reaction-reaction ring-reaction-reaction/30 bg-reaction-reaction/10',
      text: 'text-reaction-reaction'
    }
  };
</script>

<fieldset class="grid grid-cols-3 gap-2">
  <legend class="sr-only">Réaction</legend>
  {#each REACTIONS as r (r.id)}
    {@const active = value === r.id}
    {@const s = STYLES[r.id]}
    {@const Icon = r.icon}
    <label
      class={cn(
        'group relative flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-all duration-200 ease-soft',
        'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        s.tint,
        s.text,
        active
          ? cn(s.ring, 'border-2 ring-2 -translate-y-0.5 shadow-card motion-reduce:transform-none')
          : s.tintHover
      )}
    >
      <input type="radio" {name} value={r.id} bind:group={value} class="sr-only" />
      <Icon size={20} aria-hidden="true" />
      <span class="text-sm font-medium">{r.label}</span>
      {#if active}
        <span class="text-[11px] text-muted-foreground">{r.description}</span>
      {/if}
    </label>
  {/each}
</fieldset>
