<!-- src/lib/components/bento/ReminderStrip.svelte -->
<script lang="ts">
  import type { Reminder } from '$lib/server/guidance/reminders';
  import { Bell } from 'lucide-svelte';
  import { cn } from '$lib/utils/cn';

  let { reminders }: { reminders: Reminder[] } = $props();
  const first = $derived(reminders[0] ?? null);
</script>

{#if first}
  <div
    role="status"
    class={cn(
      'mb-3 flex items-start gap-3 rounded-tile border border-border/40 bg-tile-butter px-3 py-2 shadow-soft',
      first.severity === 'important' && 'bg-tile-peach text-tile-peach-foreground'
    )}
  >
    <Bell size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
    <div class="flex-1">
      <p class="text-sm font-bold leading-tight">{first.title}</p>
      <p class="text-xs text-ink-soft">{first.body}</p>
    </div>
    {#if first.cta}
      <a
        href={first.cta.href}
        class="inline-flex min-h-[44px] items-center self-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        {first.cta.label}
      </a>
    {/if}
  </div>
{/if}
