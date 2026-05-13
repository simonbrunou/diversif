<script lang="ts">
  import { AlertTriangle, Info, Sparkles, X, ChevronRight } from 'lucide-svelte';
  import { enhance } from '$app/forms';
  import { cn } from '$lib/utils/cn';
  import SourceCitation from './SourceCitation.svelte';
  import type { Reminder } from '$lib/server/guidance/reminders';

  let { reminder, formAction }: { reminder: Reminder; formAction: string } = $props();

  const ICONS = { info: Sparkles, warn: AlertTriangle, important: AlertTriangle } as const;
  const STYLES: Record<Reminder['severity'], string> = {
    info: 'border-primary/20 bg-primary/5',
    warn: 'border-reaction-inconfort/40 bg-reaction-inconfort/10',
    important: 'border-primary/40 bg-accent'
  };
  const ICON_STYLES: Record<Reminder['severity'], string> = {
    info: 'bg-primary/15 text-primary-strong',
    warn: 'bg-reaction-inconfort/20 text-reaction-inconfort',
    important: 'bg-primary text-primary-foreground'
  };

  const Icon = $derived(ICONS[reminder.severity]);
</script>

<div class={cn('relative flex gap-3 rounded-lg border p-4', STYLES[reminder.severity])}>
  <div
    class={cn(
      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
      ICON_STYLES[reminder.severity]
    )}
    aria-hidden="true"
  >
    <Icon size={18} />
  </div>

  <div class="min-w-0 flex-1">
    <h3 class="pr-8 text-sm font-semibold leading-snug">{reminder.title}</h3>
    <p class="mt-1 text-sm leading-relaxed text-foreground/90">{reminder.body}</p>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      {#if reminder.cta}
        <a
          href={reminder.cta.href}
          class="inline-flex items-center gap-1 text-sm font-medium text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
        >
          {reminder.cta.label}
          <ChevronRight size={14} aria-hidden="true" />
        </a>
      {/if}
      {#if reminder.sources && reminder.sources.length > 0}
        <SourceCitation ids={reminder.sources} inline />
      {/if}
    </div>
  </div>

  {#if reminder.dismissable}
    <form method="POST" action={formAction} use:enhance class="absolute right-2 top-2">
      <input type="hidden" name="reminderKey" value={reminder.key} />
      <button
        type="submit"
        class="rounded-full p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Masquer ce rappel"
        title="Masquer"
      >
        <Info size={0} class="hidden" />
        <X size={16} aria-hidden="true" />
      </button>
    </form>
  {/if}
</div>
