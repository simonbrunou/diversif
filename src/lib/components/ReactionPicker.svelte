<script lang="ts">
  import { Check } from 'lucide-svelte';
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
        // Visible focus ring on every option (active or not), and a
        // hover/tint cue. The :has(:focus-visible) style only paints a ring
        // when the radio receives keyboard focus, so mouse selection stays
        // quiet but tab-navigation is unmistakable.
        'group relative flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border p-3 text-center transition-all duration-200 ease-soft',
        'has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2',
        s.tint,
        s.text,
        active
          ? cn(s.ring, 'border-2 ring-2 -translate-y-0.5 shadow-card motion-reduce:transform-none')
          : s.tintHover
      )}
    >
      <input type="radio" {name} value={r.id} bind:group={value} class="sr-only" />
      {#if active}
        <!-- The label still carries `s.text` (the reaction color), so
             `bg-current` resolves to the reaction color here. The inner
             Check overrides currentColor with `text-background` so the
             tick reads as a contrasting mark on the colored disc. -->
        <span
          class="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-current"
          aria-hidden="true"
        >
          <Check size={11} strokeWidth={3} class="text-background" />
        </span>
      {/if}
      <Icon size={20} aria-hidden="true" />
      <span class={cn('text-sm', active ? 'font-semibold' : 'font-medium')}>{r.label}</span>
      {#if active}
        <span class="text-[11px] text-muted-foreground">{r.description}</span>
      {/if}
    </label>
  {/each}
</fieldset>
