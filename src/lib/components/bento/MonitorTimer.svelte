<script lang="ts">
  import Button from '$lib/components/ui/Button.svelte';
  import * as m from '$lib/paraglide/messages';
  import {
    loadTimer,
    saveTimer,
    clearTimer,
    remainingMs,
    formatRemaining,
    MONITOR_DURATION_MS
  } from '$lib/utils/monitor-timer';
  import { onMount } from 'svelte';

  let { entryId }: { entryId: string } = $props();

  let startedAt = $state<number | null>(null);
  let now = $state(Date.now());

  onMount(() => {
    const existing = loadTimer(entryId);
    if (existing) {
      startedAt = existing.startedAt;
    }
    const tick = setInterval(() => (now = Date.now()), 1000);
    return () => clearInterval(tick);
  });

  const remaining = $derived(
    startedAt === null ? MONITOR_DURATION_MS : remainingMs({ startedAt }, now)
  );

  function start() {
    const ts = Date.now();
    startedAt = ts;
    saveTimer(entryId, ts);
  }

  $effect(() => {
    if (startedAt !== null && remaining === 0) {
      clearTimer(entryId);
    }
  });
</script>

{#if startedAt === null}
  <Button
    type="button"
    size="pill"
    onclick={start}
    class="mb-2 w-full shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    {m.reactionTimerStart()}
  </Button>
{:else if remaining > 0}
  <p class="mb-2 rounded-full bg-tile-mint px-4 py-3 text-center text-sm font-bold text-tile-mint-foreground">
    {m.reactionTimerRunning({ time: formatRemaining(remaining) })}
  </p>
{:else}
  <p class="mb-2 rounded-full bg-tile-mint px-4 py-3 text-center text-sm font-bold text-tile-mint-foreground">
    {m.reactionTimerDone()}
  </p>
{/if}
