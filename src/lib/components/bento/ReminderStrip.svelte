<!-- src/lib/components/bento/ReminderStrip.svelte -->
<script lang="ts">
  import type { Reminder } from '$lib/server/guidance/reminders';
  import { Bell, ChevronDown, ChevronRight, Lightbulb, X } from 'lucide-svelte';
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';

  let { reminders }: { reminders: Reminder[] } = $props();

  const lead = $derived(reminders[0] ?? null);
  // Everything after the first used to be discarded outright: computeReminders
  // returns up to 4, sorted with `important` first, and this component rendered
  // reminders[0] only. A permanently-firing stage banner therefore outranked —
  // and silently swallowed — the actionable warn/info reminders, including the
  // repeat-exposure ones whose CTA deep-links straight into the log form.
  const rest = $derived(reminders.slice(1));
  const restLabel = $derived(
    rest.length === 1 ? m.remindersMoreOne() : m.remindersMoreOther({ count: String(rest.length) })
  );

  // A bell is a notification idiom; the brief rejects alarm idioms on routine
  // content. Only the observation reminder is genuinely time-bound, so only
  // `warn` keeps the bell — guidance gets a lightbulb.
  const LeadIcon = $derived(lead?.severity === 'warn' ? Bell : Lightbulb);
</script>

{#if lead}
  <!--
    Butter, not peach: the brief's palette assigns butter to "Streaks,
    milestones, reminders" and peach to "New / hero", and peach here collided
    with the réaction pills two tiles down. Single elevation (shadow, no
    border) per the card rules. `aside` + a real heading replaces role="status"
    — this is persistent guidance, not a live region, and as a status it was
    skipped by heading navigation while being the tallest thing on the screen.
  -->
  <aside
    aria-labelledby="reminder-lead-title"
    class="mb-3 rounded-tile bg-tile-butter px-3 py-3 text-tile-butter-foreground shadow-soft"
  >
    <div class="flex items-start gap-3">
      <LeadIcon size={16} class="mt-0.5 shrink-0" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <h2 id="reminder-lead-title" class="break-words text-sm font-bold leading-tight">
          {lead.title}
        </h2>
        <!-- break-words: guidance copy contains long unbreakable French words
             ("légumineuses") that overflowed the tile by 15px at a 195px
             viewport rather than hyphenating. -->
        <p class="mt-0.5 break-words text-xs">{lead.body}</p>
        {#if lead.cta}
          <!-- max-w-full + min-w-0 on the label: an inline-flex child will not
               shrink below its content width, so at a 195px viewport (200%
               zoom) "Voir le guide ›" hung 25px outside the tile's rounded
               corner instead of wrapping. -->
          <a
            href={lead.cta.href}
            class="mt-1 inline-flex min-h-11 max-w-full items-center gap-1 rounded text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span class="min-w-0 break-words">{lead.cta.label}</span>
            <ChevronRight size={14} class="shrink-0" aria-hidden="true" />
          </a>
        {/if}
      </div>
      {#if lead.dismissable}
        <!--
          Every stage / info / warn reminder is already flagged dismissable:true
          and the ?/dismissReminder action already accepts an arbitrary key —
          there was simply no control. Without it the 6-8 month stage banner
          sat undismissable at the top of the dashboard for ~60 days.
        -->
        <form method="POST" action="?/dismissReminder" class="shrink-0" use:enhance>
          <input type="hidden" name="reminderKey" value={lead.key} />
          <button
            type="submit"
            aria-label={m.reminderDismissLabel()}
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors duration-base ease-soft hover:bg-tile-butter-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </form>
      {/if}
    </div>

    {#if rest.length > 0}
      <!--
        Collapsed by default. Rendering all four reminders open turned the
        strip into two thirds of the first viewport — the same dominance
        problem as the old undismissable banner, just wearing a list. A
        disclosure keeps the default height to one 44px row while making the
        other reminders reachable, instead of the component silently throwing
        away three of the four values computeReminders returns.
      -->
      <details class="mt-2 border-t border-tile-butter-foreground/20">
        <summary
          class="flex min-h-11 cursor-pointer items-center gap-1 text-2xs font-semibold uppercase tracking-[0.08em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {restLabel}
          <ChevronDown size={14} class="shrink-0" aria-hidden="true" />
        </summary>
        <ul class="flex flex-col pb-1">
          {#each rest as reminder (reminder.key)}
            <li>
              {#if reminder.cta}
                <a
                  href={reminder.cta.href}
                  class="flex min-h-11 items-center justify-between gap-2 rounded text-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <span class="min-w-0 truncate">{reminder.title}</span>
                  <ChevronRight size={14} class="shrink-0" aria-hidden="true" />
                </a>
              {:else}
                <p class="flex min-h-11 items-center text-xs">{reminder.title}</p>
              {/if}
            </li>
          {/each}
        </ul>
      </details>
    {/if}
  </aside>
{/if}
