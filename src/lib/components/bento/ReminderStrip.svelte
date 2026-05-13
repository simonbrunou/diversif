<!-- src/lib/components/bento/ReminderStrip.svelte -->
<script lang="ts">
  import type { Reminder } from '$lib/server/guidance/reminders';
  import { Bell, ChevronRight } from 'lucide-svelte';
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
      {#if first.cta}
        <a
          href={first.cta.href}
          class="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          {first.cta.label}
          <ChevronRight size={14} aria-hidden="true" />
        </a>
      {/if}
    </div>
  </div>
{/if}
